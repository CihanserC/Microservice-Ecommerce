using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Order.Infrastructure.Saga;

public sealed class OrderStateMap : SagaClassMap<OrderState>
{
    protected override void Configure(EntityTypeBuilder<OrderState> entity, ModelBuilder model)
    {
        entity.ToTable("OrderSagaStates");

        entity.Property(x => x.CurrentState).HasMaxLength(64).IsRequired();
        entity.Property(x => x.UserName).HasMaxLength(100).IsRequired();
        entity.Property(x => x.TotalPrice).HasPrecision(18, 2);
        entity.Property(x => x.FailureReason).HasMaxLength(1000);
    }
}
