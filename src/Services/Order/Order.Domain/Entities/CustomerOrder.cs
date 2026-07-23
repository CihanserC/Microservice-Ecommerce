using Order.Domain.ValueObjects;

namespace Order.Domain.Entities;

public sealed class CustomerOrder
{
    private readonly List<OrderItem> _items = [];

    private CustomerOrder() { }

    public Guid Id { get; private set; }
    public string UserName { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
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
            CreatedAt = DateTime.UtcNow
        };

        order._items.AddRange(orderItems);
        return order;
    }
}
