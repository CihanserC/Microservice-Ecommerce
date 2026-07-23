using Microsoft.EntityFrameworkCore;
using Order.Infrastructure.Persistence;

namespace Order.API.Endpoints;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/orders").WithTags("Orders");

        group.MapGet("/", async (OrderDbContext dbContext, CancellationToken ct) =>
        {
            var orders = await dbContext.Orders
                .AsNoTracking()
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new OrderSummaryDto(
                    o.Id,
                    o.UserName,
                    o.CreatedAt,
                    o.Items.Sum(i => i.UnitPrice.Amount * i.Quantity)))
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
                    o.Items.Sum(i => i.UnitPrice.Amount * i.Quantity)))
                .FirstOrDefaultAsync(ct);

            return order is not null ? Results.Ok(order) : Results.NotFound();
        });
    }
}

public sealed record OrderSummaryDto(Guid Id, string UserName, DateTime CreatedAt, decimal TotalPrice);

public sealed record OrderDetailDto(
    Guid Id,
    string UserName,
    DateTime CreatedAt,
    IReadOnlyList<OrderItemDto> Items,
    decimal TotalPrice);

public sealed record OrderItemDto(Guid ProductId, string ProductName, int Quantity, decimal UnitPrice);
