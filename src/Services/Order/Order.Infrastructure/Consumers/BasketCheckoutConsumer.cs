using MassTransit;
using Microsoft.Extensions.Logging;
using Order.Domain.Entities;
using Order.Infrastructure.Persistence;
using Shared.Contracts.Events;
using Shared.Contracts.Simulation;
using Shared.Infrastructure.Simulation;

namespace Order.Infrastructure.Consumers;

public sealed class BasketCheckoutConsumer(
    OrderDbContext dbContext,
    ISimulationTracer tracer,
    ILogger<BasketCheckoutConsumer> logger) : IConsumer<BasketCheckoutEvent>
{
    public async Task Consume(ConsumeContext<BasketCheckoutEvent> context)
    {
        var message = context.Message;

        logger.LogInformation(
            "Processing checkout for user {UserName} with total {TotalPrice}",
            message.UserName,
            message.TotalPrice);

        var orderItems = message.Items
            .Select(item => OrderItem.Create(
                item.ProductId,
                item.ProductName,
                item.Quantity,
                item.UnitPrice))
            .ToList();

        var order = CustomerOrder.Create(message.UserName, orderItems);

        dbContext.Orders.Add(order);

        // Transactional outbox: Publish burada RabbitMQ'ya gitmez, OutboxMessage tablosuna eklenir.
        // SaveChanges siparişi ve olayı aynı transaction'da yazar; commit sonrası MassTransit olayı gönderir.
        // Böylece "sipariş kaydedildi ama olay kayboldu" ya da tersi olamaz.
        await context.Publish(new OrderCreatedEvent
        {
            OrderId = order.Id,
            UserName = order.UserName,
            TotalPrice = order.TotalPrice.Amount,
            CreatedAt = order.CreatedAt,
            Items = order.Items.Select(i => new OrderLine
            {
                ProductId = i.ProductId,
                ProductName = i.ProductName,
                Quantity = i.Quantity
            }).ToList()
        });

        await dbContext.SaveChangesAsync(context.CancellationToken);

        await tracer.TraceAsync(
            "Sipariş Pending olarak kaydedildi",
            TraceKinds.Database,
            detail: "Orders + OrderItems satırları ve OrderCreatedEvent (OutboxMessage) tek transaction'da yazıldı.",
            orderId: order.Id,
            payload: new { order.Id, order.UserName, status = order.Status.ToString(), total = order.TotalPrice.Amount });

        logger.LogInformation("Order {OrderId} created for user {UserName}", order.Id, order.UserName);
    }
}
