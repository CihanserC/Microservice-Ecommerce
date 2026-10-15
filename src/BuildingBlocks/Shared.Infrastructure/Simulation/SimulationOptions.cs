namespace Shared.Infrastructure.Simulation;

public sealed class SimulationOptions
{
    public const string SectionName = "Simulation";

    /// <summary>false ise hiçbir iz üretilmez; servisler simülatör olmadan da aynen çalışır.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Kısa servis kimliği (catalog, basket, order, payment). AddSimulationTracing doldurur.</summary>
    public string ServiceId { get; set; } = "unknown";
}
