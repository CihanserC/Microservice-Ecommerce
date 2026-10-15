using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Order.Domain.Entities;
using Order.Domain.ValueObjects;

namespace Order.Infrastructure.Persistence.Configurations;

public sealed class CustomerOrderConfiguration : IEntityTypeConfiguration<CustomerOrder>
{
    public void Configure(EntityTypeBuilder<CustomerOrder> builder)
    {
        builder.ToTable("Orders");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.UserName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(o => o.CreatedAt)
            .IsRequired();

        // Enum metin olarak saklanır: tabloya bakan biri "0/1/2" yerine "Pending/Completed/Cancelled" görür.
        builder.Property(o => o.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(o => o.FailureReason)
            .HasMaxLength(1000);

        builder.OwnsMany(o => o.Items, items =>
        {
            items.ToTable("OrderItems");
            items.WithOwner().HasForeignKey("OrderId");
            items.HasKey(i => i.Id);

            items.Property(i => i.ProductName)
                .HasMaxLength(200)
                .IsRequired();

            items.OwnsOne(i => i.UnitPrice, price =>
            {
                price.Property(p => p.Amount)
                    .HasColumnName("UnitPrice")
                    .HasPrecision(18, 2);
            });

            items.Ignore(i => i.LineTotal);
        });

        builder.Navigation(o => o.Items)
            .HasField("_items")
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.Ignore(o => o.TotalPrice);
    }
}
