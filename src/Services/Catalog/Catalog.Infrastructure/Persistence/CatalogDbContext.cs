using Catalog.Domain.Entities;
using MassTransit;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Persistence;

public sealed class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<StockReservation> StockReservations => Set<StockReservation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Name).HasMaxLength(200).IsRequired();
            entity.Property(p => p.Description).HasMaxLength(1000);
            entity.Property(p => p.Price).HasPrecision(18, 2);
            entity.Property(p => p.ImageUrl).HasMaxLength(500);
            entity.Property(p => p.Stock).HasDefaultValue(0);
            entity.Property(p => p.Version).IsRowVersion();
        });

        modelBuilder.Entity<StockReservation>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.HasIndex(r => r.OrderId);
        });

        // MassTransit transactional outbox + inbox tabloları:
        // InboxState aynı mesajın iki kez işlenmesini engeller,
        // OutboxMessage/OutboxState stok değişikliği ile yayınlanan olayı aynı transaction'a bağlar.
        modelBuilder.AddInboxStateEntity();
        modelBuilder.AddOutboxMessageEntity();
        modelBuilder.AddOutboxStateEntity();
    }
}
