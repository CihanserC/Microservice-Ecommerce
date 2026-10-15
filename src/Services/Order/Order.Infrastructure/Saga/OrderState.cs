using MassTransit;

namespace Order.Infrastructure.Saga;

/// <summary>
/// Saga'nın hafızası: her sipariş için bir satır. Mesajlar arasında "nerede kalmıştık?" bilgisini tutar.
/// CorrelationId = OrderId; bütün saga mesajları bu kimlikle doğru satıra bağlanır.
/// </summary>
public sealed class OrderState : SagaStateMachineInstance
{
    public Guid CorrelationId { get; set; }
    public string CurrentState { get; set; } = null!;

    public string UserName { get; set; } = string.Empty;
    public decimal TotalPrice { get; set; }
    public Guid? PaymentId { get; set; }
    public string? FailureReason { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
