using System.Collections.Concurrent;
using Payment.API.Models;

namespace Payment.API.Services;

/// <summary>
/// Gerçek bir ödeme sağlayıcısının yerini tutar. Davranışı (başarılı/başarısız/limit, gecikme)
/// simülatör arayüzünden çalışma anında değiştirilebilir.
/// Kayıtlar bellekte tutulur: servis yeniden başlarsa silinir. Bu bilinçli bir sadeleştirmedir.
/// </summary>
public sealed class PaymentSimulator
{
    private readonly ConcurrentDictionary<Guid, PaymentRecord> _payments = new();
    private volatile PaymentSettings _settings = new(PaymentMode.FailAboveLimit, Limit: 20000m, DelayMs: 1500);

    public PaymentSettings Settings => _settings;

    public PaymentSettings UpdateSettings(PaymentSettings settings)
    {
        _settings = settings with
        {
            Limit = Math.Max(0, settings.Limit),
            DelayMs = Math.Clamp(settings.DelayMs, 0, 15000)
        };
        return _settings;
    }

    public PaymentRecord? Find(Guid orderId) => _payments.GetValueOrDefault(orderId);

    public IReadOnlyList<PaymentRecord> List() =>
        _payments.Values.OrderByDescending(p => p.ProcessedAt).Take(50).ToList();

    public string? Decide(decimal amount) => _settings.Mode switch
    {
        PaymentMode.AlwaysSucceed => null,
        PaymentMode.AlwaysFail => "Banka ödemeyi reddetti (simülasyon: her zaman başarısız).",
        PaymentMode.FailAboveLimit when amount > _settings.Limit =>
            $"Kart limiti yetersiz: tutar {amount:N2} ₺, limit {_settings.Limit:N2} ₺.",
        _ => null
    };

    /// <summary>Aynı sipariş için ikinci kez çağrılırsa ilk kaydı döner (idempotency).</summary>
    public PaymentRecord Record(PaymentRecord record) => _payments.GetOrAdd(record.OrderId, record);
}
