namespace Shared.Contracts.Saga;

/// <summary>Saga → Payment: siparişin tutarını tahsil et.</summary>
public sealed record ProcessPaymentCommand
{
    public required Guid OrderId { get; init; }
    public required string UserName { get; init; }
    public required decimal Amount { get; init; }
}

/// <summary>Payment → Saga: ödeme alındı.</summary>
public sealed record PaymentCompletedEvent
{
    public required Guid OrderId { get; init; }
    public required Guid PaymentId { get; init; }
}

/// <summary>Payment → Saga: ödeme reddedildi.</summary>
public sealed record PaymentFailedEvent
{
    public required Guid OrderId { get; init; }
    public required string Reason { get; init; }
}
