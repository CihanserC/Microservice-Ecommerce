namespace Shared.Contracts.Simulation;

/// <summary>
/// Simülatör arayüzü için üretilen iz kaydı. İş akışının parçası değildir;
/// servisler "şu an ne yaptım" bilgisini bu mesajla Simulator.Web'e bildirir.
/// </summary>
public sealed record TraceEvent
{
    public required Guid Id { get; init; }
    public required DateTime Timestamp { get; init; }

    /// <summary>Kısa servis kimliği: catalog, basket, order, payment.</summary>
    public required string Service { get; init; }

    /// <summary>Bkz. <see cref="TraceKinds"/>.</summary>
    public required string Kind { get; init; }

    public required string Title { get; init; }
    public string? Detail { get; init; }

    /// <summary>Başlık ve açıklamanın İngilizcesi; arayüz dil seçimine göre birini gösterir.</summary>
    public string? TitleEn { get; init; }
    public string? DetailEn { get; init; }

    /// <summary>publish/consume için mesaj tipinin adı (ör. ReserveStockCommand).</summary>
    public string? MessageType { get; init; }

    /// <summary>Mesajın veya adımın JSON gövdesi.</summary>
    public string? Payload { get; init; }

    /// <summary>OpenTelemetry trace kimliği; aynı kullanıcı aksiyonundan doğan her şeyi birbirine bağlar.</summary>
    public string? TraceId { get; init; }

    public Guid? OrderId { get; init; }

    /// <summary>saga geçişlerinde: önceki ve yeni durum.</summary>
    public string? FromState { get; init; }
    public string? ToState { get; init; }

    /// <summary>İzi üreten kodun src/ altına göre yolu ve satırı.</summary>
    public string? CodeFile { get; init; }
    public int? CodeLine { get; init; }
}

public static class TraceKinds
{
    public const string Http = "http";
    public const string HttpResponse = "http-response";
    public const string Publish = "publish";
    public const string Consume = "consume";
    public const string Step = "step";
    public const string Database = "db";
    public const string Saga = "saga";
    public const string Error = "error";
}
