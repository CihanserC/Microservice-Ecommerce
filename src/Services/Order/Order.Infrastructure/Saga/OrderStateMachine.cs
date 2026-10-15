using System.Runtime.CompilerServices;
using MassTransit;
using Shared.Contracts.Events;
using Shared.Contracts.Saga;
using Shared.Contracts.Simulation;
using Shared.Infrastructure.Simulation;

namespace Order.Infrastructure.Saga;

/// <summary>
/// Orkestrasyon tabanlı saga. Sipariş sürecinin "beyni" burasıdır:
/// hangi servise hangi komutun gideceğine ve bir adım başarısız olursa neyin geri alınacağına bu sınıf karar verir.
///
/// Mutlu yol:
///   Initial ──OrderCreated──► AwaitingStock ──StockReserved──► AwaitingPayment ──PaymentCompleted──► Completed
///
/// Hata yolları:
///   AwaitingStock   ──StockReservationFailed──► Cancelled            (geri alınacak bir şey yok)
///   AwaitingPayment ──PaymentFailed──► Compensating ──StockReleased──► Cancelled   (stok geri bırakılır)
/// </summary>
public sealed class OrderStateMachine : MassTransitStateMachine<OrderState>
{
    private readonly ISimulationTracer _tracer;

    public OrderStateMachine(ISimulationTracer tracer)
    {
        _tracer = tracer;

        InstanceState(x => x.CurrentState);

        Event(() => OrderCreated, x => x.CorrelateById(m => m.Message.OrderId));
        Event(() => StockReserved, x => x.CorrelateById(m => m.Message.OrderId));
        Event(() => StockReservationFailed, x => x.CorrelateById(m => m.Message.OrderId));
        Event(() => PaymentCompleted, x => x.CorrelateById(m => m.Message.OrderId));
        Event(() => PaymentFailed, x => x.CorrelateById(m => m.Message.OrderId));
        Event(() => StockReleased, x => x.CorrelateById(m => m.Message.OrderId));

        // 1) Sipariş oluştu → Catalog'dan stok iste.
        Initially(
            When(OrderCreated)
                .Then(ctx =>
                {
                    ctx.Saga.UserName = ctx.Message.UserName;
                    ctx.Saga.TotalPrice = ctx.Message.TotalPrice;
                    ctx.Saga.CreatedAt = DateTime.UtcNow;
                    ctx.Saga.UpdatedAt = DateTime.UtcNow;
                })
                .TransitionTo(AwaitingStock)
                .ThenAsync(ctx => TraceTransition(ctx, Initial, AwaitingStock,
                    new("Saga başladı: Catalog'a stok ayırma komutu gönderiliyor",
                        "Saga started: sending the reserve-stock command to Catalog")))
                .Publish(ctx => new ReserveStockCommand
                {
                    OrderId = ctx.Saga.CorrelationId,
                    Items = ctx.Message.Items
                }));

        During(AwaitingStock,
            // 2a) Stok ayrıldı → Payment'tan tahsilat iste.
            When(StockReserved)
                .Then(ctx => ctx.Saga.UpdatedAt = DateTime.UtcNow)
                .TransitionTo(AwaitingPayment)
                .ThenAsync(ctx => TraceTransition(ctx, AwaitingStock, AwaitingPayment,
                    new("Stok ayrıldı: Payment'a ödeme komutu gönderiliyor",
                        "Stock reserved: sending the payment command to Payment")))
                .Publish(ctx => new ProcessPaymentCommand
                {
                    OrderId = ctx.Saga.CorrelationId,
                    UserName = ctx.Saga.UserName,
                    Amount = ctx.Saga.TotalPrice
                }),

            // 2b) Stok yok → hiçbir şey ayrılmadı, telafi gerekmez; doğrudan iptal.
            When(StockReservationFailed)
                .Then(ctx =>
                {
                    ctx.Saga.FailureReason = ctx.Message.Reason;
                    ctx.Saga.UpdatedAt = DateTime.UtcNow;
                })
                .TransitionTo(Cancelled)
                .ThenAsync(ctx => TraceTransition(ctx, AwaitingStock, Cancelled,
                    new("Stok ayrılamadı: geri alınacak adım yok, sipariş iptal",
                        "Stock could not be reserved: nothing to undo, order cancelled")))
                .Publish(ctx => new OrderCancelledEvent
                {
                    OrderId = ctx.Saga.CorrelationId,
                    Reason = ctx.Message.Reason
                }));

        During(AwaitingPayment,
            // 3a) Ödeme alındı → saga mutlu sonla biter.
            When(PaymentCompleted)
                .Then(ctx =>
                {
                    ctx.Saga.PaymentId = ctx.Message.PaymentId;
                    ctx.Saga.UpdatedAt = DateTime.UtcNow;
                })
                .TransitionTo(Completed)
                .ThenAsync(ctx => TraceTransition(ctx, AwaitingPayment, Completed,
                    new("Ödeme alındı: sipariş tamamlandı", "Payment received: order completed")))
                .Publish(ctx => new OrderCompletedEvent { OrderId = ctx.Saga.CorrelationId }),

            // 3b) Ödeme reddedildi → TELAFİ: daha önce başarılı olan stok adımını geri al.
            When(PaymentFailed)
                .Then(ctx =>
                {
                    ctx.Saga.FailureReason = ctx.Message.Reason;
                    ctx.Saga.UpdatedAt = DateTime.UtcNow;
                })
                .TransitionTo(Compensating)
                .ThenAsync(ctx => TraceTransition(ctx, AwaitingPayment, Compensating,
                    new("Ödeme reddedildi: telafi başlıyor, Catalog'a stoğu geri bırak komutu gönderiliyor",
                        "Payment declined: compensation starts, sending the release-stock command to Catalog")))
                .Publish(ctx => new ReleaseStockCommand
                {
                    OrderId = ctx.Saga.CorrelationId,
                    Reason = ctx.Message.Reason
                }));

        // 4) Telafi bitti → sipariş iptal.
        During(Compensating,
            When(StockReleased)
                .Then(ctx => ctx.Saga.UpdatedAt = DateTime.UtcNow)
                .TransitionTo(Cancelled)
                .ThenAsync(ctx => TraceTransition(ctx, Compensating, Cancelled,
                    new("Telafi tamamlandı: stok geri bırakıldı, sipariş iptal",
                        "Compensation done: stock released, order cancelled")))
                .Publish(ctx => new OrderCancelledEvent
                {
                    OrderId = ctx.Saga.CorrelationId,
                    Reason = ctx.Saga.FailureReason ?? "Ödeme başarısız."
                }));

        // Mesajlar en az bir kez (at-least-once) teslim edilir. Beklenmeyen durumda gelen tekrar
        // mesajlar (ör. Completed iken ikinci PaymentCompleted) hata üretmek yerine yok sayılır.
        OnUnhandledEvent(ctx => ctx.Ignore());

        // Completed/Cancelled bilerek "Finalize" edilmez: satır tabloda kalır ki simülatör ve
        // GET /orders saga'nın son durumunu gösterebilsin. Üretimde SetCompletedWhenFinalized ile silinebilir.
    }

    public State AwaitingStock { get; private set; } = null!;
    public State AwaitingPayment { get; private set; } = null!;
    public State Compensating { get; private set; } = null!;
    public State Completed { get; private set; } = null!;
    public State Cancelled { get; private set; } = null!;

    public Event<OrderCreatedEvent> OrderCreated { get; private set; } = null!;
    public Event<StockReservedEvent> StockReserved { get; private set; } = null!;
    public Event<StockReservationFailedEvent> StockReservationFailed { get; private set; } = null!;
    public Event<PaymentCompletedEvent> PaymentCompleted { get; private set; } = null!;
    public Event<PaymentFailedEvent> PaymentFailed { get; private set; } = null!;
    public Event<StockReleasedEvent> StockReleased { get; private set; } = null!;

    private Task TraceTransition(
        BehaviorContext<OrderState> context,
        State from,
        State to,
        TraceText title,
        [CallerFilePath] string callerFile = "",
        [CallerLineNumber] int callerLine = 0) =>
        _tracer.TraceAsync(
            title,
            TraceKinds.Saga,
            detail: new($"Saga durumu: {from.Name} → {to.Name}. Durum OrderSagaStates tablosunda saklanır.",
                $"Saga state: {from.Name} → {to.Name}. The state is stored in the OrderSagaStates table."),
            orderId: context.Saga.CorrelationId,
            payload: context.Saga,
            fromState: from.Name,
            toState: to.Name,
            callerFile: callerFile,
            callerLine: callerLine);
}
