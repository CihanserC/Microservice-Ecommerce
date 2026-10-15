using MassTransit;
using MassTransit.Testing;
using Microsoft.Extensions.DependencyInjection;
using Order.Infrastructure.Saga;
using Shared.Contracts.Events;
using Shared.Contracts.Saga;
using Shared.Infrastructure.Simulation;

namespace Order.Tests;

/// <summary>
/// Saga'yı RabbitMQ ve PostgreSQL olmadan, MassTransit'in bellek içi test harness'ı ile çalıştırır.
/// Diğer servislerin cevapları (StockReserved, PaymentFailed...) testte elle yayınlanır.
/// </summary>
public sealed class OrderStateMachineTests : IAsyncLifetime
{
    private ServiceProvider _provider = null!;
    private ITestHarness _harness = null!;
    private ISagaStateMachineTestHarness<OrderStateMachine, OrderState> _saga = null!;

    public async Task InitializeAsync()
    {
        _provider = new ServiceCollection()
            .AddSingleton<ISimulationTracer>(NullSimulationTracer.Instance)
            .AddMassTransitTestHarness(cfg =>
                cfg.AddSagaStateMachine<OrderStateMachine, OrderState>().InMemoryRepository())
            .BuildServiceProvider(true);

        _harness = _provider.GetRequiredService<ITestHarness>();
        await _harness.Start();
        _saga = _harness.GetSagaStateMachineHarness<OrderStateMachine, OrderState>();
    }

    public async Task DisposeAsync() => await _provider.DisposeAsync();

    [Fact]
    public async Task Happy_path_reserves_stock_then_takes_payment_then_completes()
    {
        var orderId = await StartSaga(total: 1899.90m);

        Assert.True(await _harness.Published.Any<ReserveStockCommand>(x => x.Context.Message.OrderId == orderId));

        await _harness.Bus.Publish(new StockReservedEvent { OrderId = orderId });
        Assert.NotNull(await _saga.Exists(orderId, m => m.AwaitingPayment));

        // Saga önce durum değiştirir (TransitionTo), sonra yayınlar; Exists dönünce mesaj henüz
        // kaydedilmemiş olabilir. Any() mesaj gelene kadar bekler, Select() beklemez.
        Assert.True(await _harness.Published.Any<ProcessPaymentCommand>(x => x.Context.Message.OrderId == orderId));
        var payment = _harness.Published.Select<ProcessPaymentCommand>(x => x.Context.Message.OrderId == orderId).FirstOrDefault();
        Assert.NotNull(payment);
        Assert.Equal(1899.90m, payment.Context.Message.Amount);

        var paymentId = Guid.NewGuid();
        await _harness.Bus.Publish(new PaymentCompletedEvent { OrderId = orderId, PaymentId = paymentId });

        Assert.NotNull(await _saga.Exists(orderId, m => m.Completed));
        Assert.True(await _harness.Published.Any<OrderCompletedEvent>(x => x.Context.Message.OrderId == orderId));
        Assert.Equal(paymentId, _saga.Sagas.Contains(orderId)!.PaymentId);
    }

    [Fact]
    public async Task Stock_failure_cancels_without_payment_or_compensation()
    {
        var orderId = await StartSaga(total: 4299m);

        await _harness.Bus.Publish(new StockReservationFailedEvent { OrderId = orderId, Reason = "Stok yetersiz" });

        Assert.NotNull(await _saga.Exists(orderId, m => m.Cancelled));
        Assert.True(await _harness.Published.Any<OrderCancelledEvent>(x => x.Context.Message.OrderId == orderId));
        Assert.False(await _harness.Published.Any<ProcessPaymentCommand>(x => x.Context.Message.OrderId == orderId));
        Assert.False(await _harness.Published.Any<ReleaseStockCommand>(x => x.Context.Message.OrderId == orderId));
    }

    [Fact]
    public async Task Payment_failure_compensates_by_releasing_stock_then_cancels()
    {
        var orderId = await StartSaga(total: 29998m);
        await _harness.Bus.Publish(new StockReservedEvent { OrderId = orderId });
        Assert.NotNull(await _saga.Exists(orderId, m => m.AwaitingPayment));

        await _harness.Bus.Publish(new PaymentFailedEvent { OrderId = orderId, Reason = "Kart limiti yetersiz" });

        Assert.NotNull(await _saga.Exists(orderId, m => m.Compensating));
        Assert.True(await _harness.Published.Any<ReleaseStockCommand>(x => x.Context.Message.OrderId == orderId));
        // Telafi bitmeden sipariş iptal edilmez.
        Assert.False(await _harness.Published.Any<OrderCancelledEvent>(x => x.Context.Message.OrderId == orderId));

        await _harness.Bus.Publish(new StockReleasedEvent { OrderId = orderId });

        Assert.NotNull(await _saga.Exists(orderId, m => m.Cancelled));
        Assert.True(await _harness.Published.Any<OrderCancelledEvent>(x => x.Context.Message.OrderId == orderId));
        var cancelled = _harness.Published.Select<OrderCancelledEvent>(x => x.Context.Message.OrderId == orderId).Single();
        Assert.Equal("Kart limiti yetersiz", cancelled.Context.Message.Reason);
    }

    [Fact]
    public async Task Duplicate_message_in_final_state_is_ignored()
    {
        var orderId = await StartSaga(total: 100m);
        await _harness.Bus.Publish(new StockReservedEvent { OrderId = orderId });
        Assert.NotNull(await _saga.Exists(orderId, m => m.AwaitingPayment));
        await _harness.Bus.Publish(new PaymentCompletedEvent { OrderId = orderId, PaymentId = Guid.NewGuid() });
        Assert.NotNull(await _saga.Exists(orderId, m => m.Completed));

        // At-least-once teslimat: aynı olay ikinci kez gelir.
        await _harness.Bus.Publish(new StockReservedEvent { OrderId = orderId });
        await _harness.InactivityTask;

        Assert.NotNull(await _saga.Exists(orderId, m => m.Completed));
        Assert.False(await _harness.Published.Any<Fault<StockReservedEvent>>());
        Assert.Single(_harness.Published.Select<ProcessPaymentCommand>(x => x.Context.Message.OrderId == orderId));
    }

    private async Task<Guid> StartSaga(decimal total)
    {
        var orderId = NewId.NextGuid();
        await _harness.Bus.Publish(new OrderCreatedEvent
        {
            OrderId = orderId,
            UserName = "ayse",
            TotalPrice = total,
            CreatedAt = DateTime.UtcNow,
            Items = [new OrderLine { ProductId = Guid.NewGuid(), ProductName = "Test ürünü", Quantity = 1 }]
        });

        Assert.NotNull(await _saga.Exists(orderId, m => m.AwaitingStock));
        return orderId;
    }
}
