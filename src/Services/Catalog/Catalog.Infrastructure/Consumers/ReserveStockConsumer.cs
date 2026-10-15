using Catalog.Domain.Entities;
using Catalog.Infrastructure.Persistence;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Shared.Contracts.Saga;
using Shared.Contracts.Simulation;
using Shared.Infrastructure.Simulation;

namespace Catalog.Infrastructure.Consumers;

/// <summary>
/// Saga'nın ilk adımı: siparişin bütün kalemleri için stok ayırır ya da hiçbirini ayırmaz.
/// "Ya hepsi ya hiçbiri" kuralı tek serviste (tek DB transaction'ında) kalır;
/// servisler arası geri alma ise saga'nın işidir.
/// </summary>
public sealed class ReserveStockConsumer(
    CatalogDbContext dbContext,
    ISimulationTracer tracer) : IConsumer<ReserveStockCommand>
{
    public async Task Consume(ConsumeContext<ReserveStockCommand> context)
    {
        var message = context.Message;
        var ct = context.CancellationToken;

        // Idempotency: mesaj tekrar gelirse (ör. retry, yeniden teslim) stok ikinci kez düşmemeli.
        var alreadyReserved = await dbContext.StockReservations.AnyAsync(r => r.OrderId == message.OrderId, ct);
        if (alreadyReserved)
        {
            await tracer.TraceAsync(
                "Bu sipariş için stok zaten ayrılmış, tekrar düşülmedi",
                detail: "Aynı komut ikinci kez geldi. Sonuç olayı yeniden yayınlanır, stok değişmez.",
                orderId: message.OrderId);
            await context.Publish(new StockReservedEvent { OrderId = message.OrderId });
            return;
        }

        var productIds = message.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await dbContext.Products
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var shortages = message.Items
            .Where(item => !products.TryGetValue(item.ProductId, out var product) || product.Stock < item.Quantity)
            .Select(item => products.TryGetValue(item.ProductId, out var product)
                ? $"{product.Name}: istenen {item.Quantity}, stokta {product.Stock}"
                : $"{item.ProductName}: katalogda yok")
            .ToList();

        if (shortages.Count > 0)
        {
            var reason = "Stok yetersiz — " + string.Join("; ", shortages);
            await tracer.TraceAsync(
                "Stok yetersiz, hiçbir kalem ayrılmadı",
                detail: reason,
                orderId: message.OrderId);

            await context.Publish(new StockReservationFailedEvent
            {
                OrderId = message.OrderId,
                Reason = reason
            });
            // Outbox kullanıldığı için olay ancak SaveChanges ile birlikte gerçekten gönderilir.
            await dbContext.SaveChangesAsync(ct);
            return;
        }

        foreach (var item in message.Items)
        {
            products[item.ProductId].Stock -= item.Quantity;
            dbContext.StockReservations.Add(new StockReservation
            {
                Id = Guid.NewGuid(),
                OrderId = message.OrderId,
                ProductId = item.ProductId,
                Quantity = item.Quantity
            });
        }

        await context.Publish(new StockReservedEvent { OrderId = message.OrderId });

        // Stok düşüşü, rezervasyon kayıtları ve StockReservedEvent (outbox) tek transaction'da yazılır.
        await dbContext.SaveChangesAsync(ct);

        await tracer.TraceAsync(
            "Stok düşüldü ve rezervasyon kaydedildi",
            TraceKinds.Database,
            detail: "Products.Stock azaltıldı, StockReservations'a satır eklendi, StockReservedEvent outbox'a yazıldı — hepsi tek transaction.",
            orderId: message.OrderId,
            payload: message.Items.Select(i => new
            {
                product = products[i.ProductId].Name,
                reserved = i.Quantity,
                remainingStock = products[i.ProductId].Stock
            }));
    }
}
