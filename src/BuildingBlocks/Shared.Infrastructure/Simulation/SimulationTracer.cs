using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Channels;
using MassTransit;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Shared.Contracts.Simulation;

namespace Shared.Infrastructure.Simulation;

/// <summary>
/// İzi oluşturur ve bellek içi kuyruğa bırakır; çağıran kod hiçbir zaman beklemez.
/// RabbitMQ'ya gönderim <see cref="SimulationTracePublisher"/> içinde, sırayı koruyarak yapılır.
/// Böylece aracı (broker) yavaş ya da kapalıyken bile HTTP istekleri ve consumer'lar etkilenmez.
/// </summary>
public sealed partial class SimulationTracer(
    SimulationTraceQueue queue,
    IOptions<SimulationOptions> options) : ISimulationTracer
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    public Task TraceAsync(
        string title,
        string kind = TraceKinds.Step,
        string? detail = null,
        Guid? orderId = null,
        object? payload = null,
        string? messageType = null,
        string? fromState = null,
        string? toState = null,
        string callerFile = "",
        int callerLine = 0)
    {
        if (!options.Value.Enabled)
            return Task.CompletedTask;

        queue.Enqueue(new TraceEvent
        {
            Id = Guid.NewGuid(),
            Timestamp = DateTime.UtcNow,
            Service = options.Value.ServiceId,
            Kind = kind,
            Title = title,
            Detail = detail,
            MessageType = messageType,
            Payload = payload is null ? null : SerializePayload(payload),
            // Trace kimliği burada, çağıranın Activity'si hâlâ aktifken alınır.
            TraceId = Activity.Current?.TraceId.ToString(),
            OrderId = orderId,
            FromState = fromState,
            ToState = toState,
            CodeFile = ToSourceRelativePath(callerFile),
            CodeLine = callerLine > 0 ? callerLine : null
        });

        return Task.CompletedTask;
    }

    private static string? SerializePayload(object payload)
    {
        try
        {
            return JsonSerializer.Serialize(payload, payload.GetType(), JsonOptions);
        }
        catch (Exception)
        {
            return null;
        }
    }

    /// <summary>
    /// Derleme makinesine göre değişen mutlak yolu (C:\...\src\Services\... veya /src/src/Services/...)
    /// "Services/Order/..." biçimine indirger. Simülatör kaynak dosyayı bu yolla bulur.
    /// </summary>
    public static string? ToSourceRelativePath(string callerFile)
    {
        if (string.IsNullOrEmpty(callerFile))
            return null;

        var match = SourcePathRegex().Match(callerFile.Replace('\\', '/'));
        return match.Success ? match.Groups[1].Value : null;
    }

    [GeneratedRegex(@"(?:^|/)src/((?:Services|BuildingBlocks|ApiGateways|Web)/.+)$", RegexOptions.IgnoreCase)]
    private static partial Regex SourcePathRegex();
}

/// <summary>Sınırlı kuyruk: dolarsa en eski iz düşer, uygulama belleği şişmez.</summary>
public sealed class SimulationTraceQueue
{
    private readonly Channel<TraceEvent> _channel = Channel.CreateBounded<TraceEvent>(
        new BoundedChannelOptions(1000)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true
        });

    public void Enqueue(TraceEvent traceEvent) => _channel.Writer.TryWrite(traceEvent);

    public ChannelReader<TraceEvent> Reader => _channel.Reader;
}

/// <summary>
/// Kuyruktaki izleri tek tek RabbitMQ'ya yayınlar. IBus burada, uygulama başladıktan sonra çözülür;
/// state machine gibi bus kurulurken oluşturulan nesneler tracer'a bağımlı olduğunda döngü oluşmaz.
/// </summary>
public sealed class SimulationTracePublisher(
    SimulationTraceQueue queue,
    IServiceProvider serviceProvider,
    ILogger<SimulationTracePublisher> logger) : BackgroundService
{
    private static readonly TimeSpan PublishTimeout = TimeSpan.FromSeconds(3);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var bus = serviceProvider.GetRequiredService<IBus>();

        await foreach (var traceEvent in queue.Reader.ReadAllAsync(stoppingToken))
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            timeout.CancelAfter(PublishTimeout);

            try
            {
                await bus.Publish(traceEvent, timeout.Token);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                // İz kaybolabilir; iş akışı asla bu yüzden bozulmamalı.
                logger.LogDebug(ex, "Simulation trace dropped");
            }
        }
    }
}
