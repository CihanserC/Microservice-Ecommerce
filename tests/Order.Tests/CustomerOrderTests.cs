using Order.Domain.Entities;

namespace Order.Tests;

public sealed class CustomerOrderTests
{
    private static CustomerOrder NewOrder() =>
        CustomerOrder.Create("ayse", [OrderItem.Create(Guid.NewGuid(), "Klavye", 2, 100m)]);

    [Fact]
    public void New_order_is_pending_and_total_is_calculated_from_items()
    {
        var order = NewOrder();

        Assert.Equal(OrderStatus.Pending, order.Status);
        Assert.Equal(200m, order.TotalPrice.Amount);
    }

    [Fact]
    public void Cancel_keeps_reason_and_is_idempotent()
    {
        var order = NewOrder();

        order.Cancel("Stok yetersiz");
        order.Cancel("ikinci kez");

        Assert.Equal(OrderStatus.Cancelled, order.Status);
        Assert.Equal("Stok yetersiz", order.FailureReason);
    }

    [Fact]
    public void Completed_order_cannot_be_cancelled()
    {
        var order = NewOrder();
        order.Complete();

        Assert.Throws<InvalidOperationException>(() => order.Cancel("geç kalan iptal"));
    }
}
