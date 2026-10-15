namespace Shared.Contracts.Saga;

/// <summary>Saga'nın mutlu sonu: stok ayrıldı, ödeme alındı.</summary>
public sealed record OrderCompletedEvent
{
    public required Guid OrderId { get; init; }
}

/// <summary>Saga'nın başarısız sonu: gerekli telafiler yapıldıktan sonra yayınlanır.</summary>
public sealed record OrderCancelledEvent
{
    public required Guid OrderId { get; init; }
    public required string Reason { get; init; }
}
