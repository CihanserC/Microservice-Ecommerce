using Catalog.Infrastructure.Persistence;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Shared.Contracts.Saga;
using Shared.Contracts.Simulation;
using Shared.Infrastructure.Simulation;

namespace Catalog.Infrastructure.Consumers;

/// <summary>
/// Telafi (compensation) adımı: ödeme başarısız olunca saga, daha önce ayrılan stoğun
/// geri bırakılmasını ister. Bu bir "rollback" değildir; önceki işlemi tersine çeviren yeni bir işlemdir.
/// </summary>
public sealed class ReleaseStockConsumer(
    CatalogDbContext dbContext,
    ISimulationTracer tracer) : IConsumer<ReleaseStockCommand>
{
    public async Task Consume(ConsumeContext<ReleaseStockCommand> context)
    {
        var message = context.Message;
        var ct = context.CancellationToken;

        var reservations = await dbContext.StockReservations
            .Where(r => r.OrderId == message.OrderId)
            .ToListAsync(ct);

        // Idempotency: rezervasyon yoksa (zaten bırakılmış) stok ikinci kez artırılmaz.
        if (reservations.Count > 0)
        {
            var productIds = reservations.Select(r => r.ProductId).ToList();
            var products = await dbContext.Products
                .Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, ct);

            foreach (var reservation in reservations)
            {
                if (products.TryGetValue(reservation.ProductId, out var product))
                    product.Stock += reservation.Quantity;
            }

            dbContext.StockReservations.RemoveRange(reservations);
        }

        await context.Publish(new StockReleasedEvent { OrderId = message.OrderId });
        await dbContext.SaveChangesAsync(ct);

        await tracer.TraceAsync(
            reservations.Count > 0 ? "Telafi: ayrılan stok geri eklendi" : "Telafi: geri bırakılacak rezervasyon yok",
            TraceKinds.Database,
            detail: $"Sebep: {message.Reason}. Products.Stock artırıldı, StockReservations satırları silindi.",
            orderId: message.OrderId,
            payload: reservations.Select(r => new { r.ProductId, released = r.Quantity }));
    }
}
