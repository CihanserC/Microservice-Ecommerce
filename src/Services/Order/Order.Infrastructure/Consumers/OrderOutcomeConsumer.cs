using MassTransit;
using Microsoft.EntityFrameworkCore;
using Order.Infrastructure.Persistence;
using Shared.Contracts.Saga;
using Shared.Contracts.Simulation;
using Shared.Infrastructure.Simulation;

namespace Order.Infrastructure.Consumers;

/// <summary>
/// Saga'nın sonucunu sipariş aggregate'ine yansıtır.
/// Saga (süreç) ile sipariş (iş kaydı) bilerek ayrıdır: saga bir gün ayrı bir servise taşınsa bile
/// Order servisi yalnızca bu iki olayı dinlemeye devam eder.
/// </summary>
public sealed class OrderOutcomeConsumer(
    OrderDbContext dbContext,
    ISimulationTracer tracer) :
    IConsumer<OrderCompletedEvent>,
    IConsumer<OrderCancelledEvent>
{
    public async Task Consume(ConsumeContext<OrderCompletedEvent> context)
    {
        var order = await dbContext.Orders
            .FirstOrDefaultAsync(o => o.Id == context.Message.OrderId, context.CancellationToken);
        if (order is null)
            return;

        order.Complete();
        await dbContext.SaveChangesAsync(context.CancellationToken);

        await tracer.TraceAsync(
            new("Sipariş durumu Completed yapıldı", "Order status set to Completed"),
            TraceKinds.Database,
            detail: new("CustomerOrder.Complete() çağrıldı; Orders.Status güncellendi.",
                "CustomerOrder.Complete() was called; Orders.Status was updated."),
            orderId: order.Id);
    }

    public async Task Consume(ConsumeContext<OrderCancelledEvent> context)
    {
        var order = await dbContext.Orders
            .FirstOrDefaultAsync(o => o.Id == context.Message.OrderId, context.CancellationToken);
        if (order is null)
            return;

        order.Cancel(context.Message.Reason);
        await dbContext.SaveChangesAsync(context.CancellationToken);

        await tracer.TraceAsync(
            new("Sipariş durumu Cancelled yapıldı", "Order status set to Cancelled"),
            TraceKinds.Database,
            detail: new($"CustomerOrder.Cancel() çağrıldı. Sebep: {context.Message.Reason}",
                $"CustomerOrder.Cancel() was called. Reason: {context.Message.Reason}"),
            orderId: order.Id);
    }
}
