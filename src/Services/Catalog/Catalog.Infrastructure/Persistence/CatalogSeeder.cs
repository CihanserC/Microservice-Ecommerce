using Catalog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Persistence;

/// <summary>
/// Simülatörün ilk açılışta boş ekran göstermemesi için örnek ürünler.
/// Stok değerleri senaryolara göre seçildi: bol stok (mutlu yol), az stok, sıfır stok (stok hatası).
/// </summary>
public static class CatalogSeeder
{
    public static async Task SeedAsync(CatalogDbContext context, CancellationToken cancellationToken = default)
    {
        if (await context.Products.AnyAsync(cancellationToken))
            return;

        context.Products.AddRange(
            new Product
            {
                Id = Guid.Parse("8a1c4f7e-0b1d-4c3a-9e57-1f0a2b3c4d01"),
                Name = "Mekanik Klavye",
                Description = "Bol stoklu ürün — mutlu yol senaryosu için.",
                Price = 1899.90m,
                Stock = 50
            },
            new Product
            {
                Id = Guid.Parse("8a1c4f7e-0b1d-4c3a-9e57-1f0a2b3c4d02"),
                Name = "Kablosuz Mouse",
                Description = "Ucuz ürün — ödeme limiti altında kalır.",
                Price = 649.50m,
                Stock = 25
            },
            new Product
            {
                Id = Guid.Parse("8a1c4f7e-0b1d-4c3a-9e57-1f0a2b3c4d03"),
                Name = "4K Monitör",
                Description = "Pahalı ve az stoklu — ödeme limitini aşmak için.",
                Price = 14999.00m,
                Stock = 3
            },
            new Product
            {
                Id = Guid.Parse("8a1c4f7e-0b1d-4c3a-9e57-1f0a2b3c4d04"),
                Name = "Sınırlı Sürüm Kulaklık",
                Description = "Stokta yok — stok yetersiz senaryosu için.",
                Price = 4299.00m,
                Stock = 0
            });

        await context.SaveChangesAsync(cancellationToken);
    }
}
