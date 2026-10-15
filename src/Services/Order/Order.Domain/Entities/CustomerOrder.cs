using Order.Domain.ValueObjects;

namespace Order.Domain.Entities;

public sealed class CustomerOrder
{
    private readonly List<OrderItem> _items = [];

    private CustomerOrder() { }

    public Guid Id { get; private set; }
    public string UserName { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
    public OrderStatus Status { get; private set; }
    public string? FailureReason { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    public Money TotalPrice => _items.Aggregate(Money.Zero, (total, item) => total + item.LineTotal);

    public static CustomerOrder Create(string userName, IEnumerable<OrderItem> items)
    {
        var orderItems = items.ToList();
        if (orderItems.Count == 0)
            throw new InvalidOperationException("An order must contain at least one item.");

        var order = new CustomerOrder
        {
            Id = Guid.NewGuid(),
            UserName = userName,
            CreatedAt = DateTime.UtcNow,
            Status = OrderStatus.Pending
        };

        order._items.AddRange(orderItems);
        return order;
    }

    /// <summary>Saga mutlu sonla bittiğinde çağrılır. Aynı olay iki kez gelirse sessizce geçer.</summary>
    public void Complete()
    {
        if (Status == OrderStatus.Completed)
            return;

        if (Status == OrderStatus.Cancelled)
            throw new InvalidOperationException("A cancelled order cannot be completed.");

        Status = OrderStatus.Completed;
        ClosedAt = DateTime.UtcNow;
    }

    /// <summary>Saga telafileri bitirip siparişi iptal ettiğinde çağrılır.</summary>
    public void Cancel(string reason)
    {
        if (Status == OrderStatus.Cancelled)
            return;

        if (Status == OrderStatus.Completed)
            throw new InvalidOperationException("A completed order cannot be cancelled.");

        Status = OrderStatus.Cancelled;
        FailureReason = reason;
        ClosedAt = DateTime.UtcNow;
    }
}
