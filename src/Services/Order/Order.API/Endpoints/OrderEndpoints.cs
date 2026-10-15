using Microsoft.EntityFrameworkCore;
using Order.Domain.Entities;
using Order.Infrastructure.Persistence;

namespace Order.API.Endpoints;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/orders").WithTags("Orders");

        // Sipariş (iş kaydı) ile saga (süreç) aynı veritabanındadır ama ayrı tablolardır.
        // Liste ikisini birleştirir: Status sonucu, SagaState ise sürecin şu an hangi adımda olduğunu söyler.
        group.MapGet("/", async (OrderDbContext dbContext, CancellationToken ct) =>
        {
            var orders = await (
                    from o in dbContext.Orders.AsNoTracking()
                    join s in dbContext.OrderSagas.AsNoTracking() on o.Id equals s.CorrelationId into sagas
                    from s in sagas.DefaultIfEmpty()
                    orderby o.CreatedAt descending
                    select new OrderSummaryDto(
                        o.Id,
                        o.UserName,
                        o.CreatedAt,
                        o.Items.Sum(i => i.UnitPrice.Amount * i.Quantity),
                        o.Status,
                        s != null ? s.CurrentState : null,
                        o.FailureReason))
                .Take(50)
                .ToListAsync(ct);

            return Results.Ok(orders);
        });

        group.MapGet("/{id:guid}", async (Guid id, OrderDbContext dbContext, CancellationToken ct) =>
        {
            var order = await dbContext.Orders
                .AsNoTracking()
                .Where(o => o.Id == id)
                .Select(o => new OrderDetailDto(
                    o.Id,
                    o.UserName,
                    o.CreatedAt,
                    o.Items.Select(i => new OrderItemDto(
                        i.ProductId,
                        i.ProductName,
                        i.Quantity,
                        i.UnitPrice.Amount)).ToList(),
                    o.Items.Sum(i => i.UnitPrice.Amount * i.Quantity),
                    o.Status,
                    o.FailureReason,
                    null))
                .FirstOrDefaultAsync(ct);

            if (order is null)
                return Results.NotFound();

            var saga = await dbContext.OrderSagas
                .AsNoTracking()
                .Where(s => s.CorrelationId == id)
                .Select(s => new OrderSagaDto(s.CurrentState, s.PaymentId, s.FailureReason, s.CreatedAt, s.UpdatedAt))
                .FirstOrDefaultAsync(ct);

            return Results.Ok(order with { Saga = saga });
        });
    }
}

public sealed record OrderSummaryDto(
    Guid Id,
    string UserName,
    DateTime CreatedAt,
    decimal TotalPrice,
    OrderStatus Status,
    string? SagaState,
    string? FailureReason);

public sealed record OrderDetailDto(
    Guid Id,
    string UserName,
    DateTime CreatedAt,
    IReadOnlyList<OrderItemDto> Items,
    decimal TotalPrice,
    OrderStatus Status,
    string? FailureReason,
    OrderSagaDto? Saga);

public sealed record OrderItemDto(Guid ProductId, string ProductName, int Quantity, decimal UnitPrice);

public sealed record OrderSagaDto(
    string CurrentState,
    Guid? PaymentId,
    string? FailureReason,
    DateTime CreatedAt,
    DateTime UpdatedAt);
