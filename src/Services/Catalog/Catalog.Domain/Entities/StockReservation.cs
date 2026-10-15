namespace Catalog.Domain.Entities;

/// <summary>
/// Bir siparişin hangi üründen kaç adet ayırdığını tutar.
/// Telafi (ReleaseStockCommand) yalnızca OrderId taşır; neyin geri bırakılacağını Catalog bu tablodan bilir.
/// Aynı tablo idempotency sağlar: aynı sipariş için ikinci ayırma isteği stoğu bir daha düşürmez.
/// </summary>
public sealed class StockReservation
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
