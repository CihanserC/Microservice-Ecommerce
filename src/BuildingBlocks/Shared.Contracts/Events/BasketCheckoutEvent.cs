namespace Shared.Contracts.Events;

public sealed record BasketCheckoutEvent
{
    public required string UserName { get; init; }
    public required decimal TotalPrice { get; init; }
    public required IReadOnlyList<BasketCheckoutItem> Items { get; init; }
}

public sealed record BasketCheckoutItem
{
    public required Guid ProductId { get; init; }
    public required string ProductName { get; init; }
    public required int Quantity { get; init; }
    public required decimal UnitPrice { get; init; }
}
