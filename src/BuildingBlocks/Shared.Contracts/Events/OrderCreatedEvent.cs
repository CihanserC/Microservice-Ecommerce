namespace Shared.Contracts.Events;

public sealed record OrderCreatedEvent
{
    public required Guid OrderId { get; init; }
    public required string UserName { get; init; }
    public required decimal TotalPrice { get; init; }
    public required DateTime CreatedAt { get; init; }
}
