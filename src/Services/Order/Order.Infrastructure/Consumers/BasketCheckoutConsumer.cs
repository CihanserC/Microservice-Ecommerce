using MassTransit;
using Microsoft.Extensions.Logging;
using Order.Domain.Entities;
using Order.Infrastructure.Persistence;
using Shared.Contracts.Events;

namespace Order.Infrastructure.Consumers;

public sealed class BasketCheckoutConsumer(
    OrderDbContext dbContext,
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
        await dbContext.SaveChangesAsync(context.CancellationToken);

        logger.LogInformation("Order {OrderId} created for user {UserName}", order.Id, order.UserName);
    }
}
