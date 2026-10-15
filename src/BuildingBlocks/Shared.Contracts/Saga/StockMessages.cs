using Shared.Contracts.Events;

namespace Shared.Contracts.Saga;

/// <summary>Saga → Catalog: siparişin kalemleri için stok ayır.</summary>
public sealed record ReserveStockCommand
{
    public required Guid OrderId { get; init; }
    public required IReadOnlyList<OrderLine> Items { get; init; }
}

/// <summary>Catalog → Saga: stok ayrıldı.</summary>
public sealed record StockReservedEvent
{
    public required Guid OrderId { get; init; }
}

/// <summary>Catalog → Saga: stok yetersiz, hiçbir şey ayrılmadı.</summary>
public sealed record StockReservationFailedEvent
{
    public required Guid OrderId { get; init; }
    public required string Reason { get; init; }
}

/// <summary>
/// Saga → Catalog: telafi (compensation) adımı. Daha önce ayrılan stoğu geri bırak.
/// Catalog ayırdığı kalemleri OrderId ile kendisi bildiği için mesaj yalnızca kimlik taşır.
/// </summary>
public sealed record ReleaseStockCommand
{
    public required Guid OrderId { get; init; }
    public required string Reason { get; init; }
}

/// <summary>Catalog → Saga: ayrılan stok geri bırakıldı.</summary>
public sealed record StockReleasedEvent
{
    public required Guid OrderId { get; init; }
}
