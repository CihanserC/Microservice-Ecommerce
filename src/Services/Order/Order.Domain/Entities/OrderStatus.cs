namespace Order.Domain.Entities;

/// <summary>
/// Siparişin iş açısından durumu. Saga'nın ara adımları (stok bekleniyor, ödeme bekleniyor)
/// burada değil, OrderState.CurrentState içinde tutulur: aggregate yalnızca sonucu bilir.
/// </summary>
public enum OrderStatus
{
    Pending,
    Completed,
    Cancelled
}
