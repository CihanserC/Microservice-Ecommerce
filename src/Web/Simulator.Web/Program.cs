using System.Net.ServerSentEvents;
using System.Runtime.CompilerServices;
using MassTransit;
using Shared.Contracts.Simulation;
using Shared.Infrastructure.Extensions;
using Simulator.Web.SourceCode;
using Simulator.Web.Tracing;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSharedSerilog("Simulator.Web");

builder.Services.AddSingleton<TraceHub>();
builder.Services.AddSingleton<SourceCodeProvider>();
builder.Services.AddHealthChecks();

// Simülatör iş akışına katılmaz; yalnızca TraceEvent dinler.
// Kuyruk geçicidir (auto-delete): simülatör kapalıyken izler birikmez.
builder.Services.AddMassTransit(bus =>
{
    bus.AddConsumer<TraceEventConsumer>();

    bus.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMq:Host"] ?? "localhost", "/", h =>
        {
            h.Username(builder.Configuration["RabbitMq:Username"] ?? "guest");
            h.Password(builder.Configuration["RabbitMq:Password"] ?? "guest");
        });

        cfg.ReceiveEndpoint("simulator-traces", endpoint =>
        {
            endpoint.Durable = false;
            endpoint.AutoDelete = true;
            // Tek tek işle: izler geldiği sırayla tarayıcıya aksın.
            endpoint.ConcurrentMessageLimit = 1;
            endpoint.ConfigureConsumer<TraceEventConsumer>(context);
        });
    });
});

var app = builder.Build();

app.UseDefaultFiles();
// Arayüz ES modüllerinden oluşur; tarayıcı bir kısmını eski önbellekten, bir kısmını yeni sürümden
// alırsa modüller birbirini bulamaz. "no-cache" her seferinde ETag ile doğrulatır (değişmediyse 304).
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache"
});

var sim = app.MapGroup("/sim");

// Server-Sent Events: tarayıcı tek bir HTTP bağlantısını açık tutar, sunucu her izi anında iter.
sim.MapGet("/events", (TraceHub hub, CancellationToken ct) =>
    TypedResults.ServerSentEvents(StreamTraces(hub, ct)));

sim.MapGet("/history", (TraceHub hub, int? take) =>
    Results.Ok(hub.History(Math.Clamp(take ?? 300, 1, 1000))));

sim.MapDelete("/history", (TraceHub hub) =>
{
    hub.Clear();
    return Results.NoContent();
});

sim.MapGet("/source", async (string path, SourceCodeProvider provider, CancellationToken ct) =>
{
    var content = await provider.ReadAsync(path, ct);
    return content is null
        ? Results.NotFound(new { message = $"'{path}' okunamadı." })
        : Results.Text(content, "text/plain; charset=utf-8");
});

sim.MapGet("/status", (SourceCodeProvider provider) =>
    Results.Ok(new { sourceAvailable = provider.IsAvailable }));

app.MapHealthChecks("/health");

app.Run();

static async IAsyncEnumerable<SseItem<TraceEvent?>> StreamTraces(
    TraceHub hub,
    [EnumeratorCancellation] CancellationToken cancellationToken)
{
    var channel = hub.Subscribe();
    try
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            // 15 sn boyunca iz gelmezse "ping" gönder: gateway ve proxy'ler boş bağlantıyı kapatmasın.
            using var heartbeat = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            heartbeat.CancelAfter(TimeSpan.FromSeconds(15));

            TraceEvent? next = null;
            try
            {
                next = await channel.Reader.ReadAsync(heartbeat.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
            }

            yield return next is null
                ? new SseItem<TraceEvent?>(null, "ping")
                : new SseItem<TraceEvent?>(next, "trace");
        }
    }
    finally
    {
        hub.Unsubscribe(channel);
    }
}
