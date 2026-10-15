namespace Catalog.Domain.Entities;

public sealed class Product
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }

    /// <summary>Satılabilir adet. Saga stok ayırdığında düşer, telafi adımında geri artar.</summary>
    public int Stock { get; set; }

    /// <summary>
    /// İyimser eşzamanlılık belirteci (PostgreSQL xmin). İki sipariş aynı anda son ürünü ayırmaya
    /// çalışırsa ikinci SaveChanges DbUpdateConcurrencyException alır ve MassTransit retry'ı devreye girer.
    /// </summary>
    public uint Version { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
