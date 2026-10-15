namespace Payment.API.Models;

public enum PaymentMode
{
    /// <summary>Her ödeme onaylanır (mutlu yol).</summary>
    AlwaysSucceed,

    /// <summary>Her ödeme reddedilir (telafi senaryosu).</summary>
    AlwaysFail,

    /// <summary>Tutar limiti aşarsa reddedilir (gerçekçi kart limiti).</summary>
    FailAboveLimit
}

public sealed record PaymentSettings(PaymentMode Mode, decimal Limit, int DelayMs);

public sealed record PaymentRecord(
    Guid PaymentId,
    Guid OrderId,
    string UserName,
    decimal Amount,
    bool Succeeded,
    string? FailureReason,
    DateTime ProcessedAt);
