namespace Shared.Contracts.Events;

/// <summary>
/// Order servisi siparişi kaydettiğinde yayınlanır. Saga bu olayla başlar.
/// </summary>
public sealed record OrderCreatedEvent
{
    public required Guid OrderId { get; init; }
    public required string UserName { get; init; }
    public required decimal TotalPrice { get; init; }
    public required DateTime CreatedAt { get; init; }
    public required IReadOnlyList<OrderLine> Items { get; init; }
}

public sealed record OrderLine
{
    public required Guid ProductId { get; init; }
    public required string ProductName { get; init; }
    public required int Quantity { get; init; }
}
