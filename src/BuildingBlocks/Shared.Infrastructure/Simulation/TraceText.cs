namespace Shared.Infrastructure.Simulation;

/// <summary>
/// Simülatörde gösterilen iki dilli metin (Türkçe + İngilizce). Arayüz dil değişince yeniden
/// istek atmadan diğer metni gösterir. Düz <see cref="string"/> iki dilde aynı kabul edilir
/// (ör. "HTTP GET /api/products" veya bir istisna mesajı).
/// </summary>
public readonly record struct TraceText(string Tr, string En)
{
    public static implicit operator TraceText(string text) => new(text, text);
}
