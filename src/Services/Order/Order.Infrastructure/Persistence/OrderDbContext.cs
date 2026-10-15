using MassTransit;
using Microsoft.EntityFrameworkCore;
using Order.Domain.Entities;
using Order.Infrastructure.Saga;

namespace Order.Infrastructure.Persistence;

public sealed class OrderDbContext(DbContextOptions<OrderDbContext> options) : DbContext(options)
{
    public DbSet<CustomerOrder> Orders => Set<CustomerOrder>();
    public DbSet<OrderState> OrderSagas => Set<OrderState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(OrderDbContext).Assembly);

        // Saga durumu sipariş ile aynı veritabanında; saga geçişi ile gönderdiği komut
        // outbox sayesinde tek transaction'da kaydedilir.
        new OrderStateMap().Configure(modelBuilder);

        modelBuilder.AddInboxStateEntity();
        modelBuilder.AddOutboxMessageEntity();
        modelBuilder.AddOutboxStateEntity();
    }
}
