using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Shared.Contracts.Simulation;

namespace Shared.Infrastructure.Simulation;

/// <summary>
/// Gateway'den servise gelen her HTTP isteğini iki iz olarak bildirir:
/// istek geldiğinde (Gateway → servis) ve cevap döndüğünde (servis → Gateway).
/// Arada üretilen izler (DB yazımı, publish) böylece doğru sırada görünür.
///
/// Atlananlar: /health ve simülatörün listeleri tazelemek için attığı arka plan istekleri
/// (X-Simulator-Background başlığı). Aksi halde her yenileme yeni iz, her iz yeni yenileme üretirdi.
/// </summary>
public sealed class SimulationHttpTraceMiddleware(RequestDelegate next, ISimulationTracer tracer)
{
    public const string BackgroundHeader = "X-Simulator-Background";

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/health") ||
            context.Request.Headers.ContainsKey(BackgroundHeader))
        {
            await next(context);
            return;
        }

        var request = context.Request;
        var route = $"{request.Method} {request.Path}{request.QueryString}";

        await tracer.TraceAsync(
            $"HTTP {route}",
            TraceKinds.Http,
            detail: new("Senkron çağrı: istemci bu isteğin cevabını bekliyor.",
                "Synchronous call: the client is waiting for this response."),
            payload: new { method = request.Method, path = request.Path.Value },
            callerFile: "",
            callerLine: 0);

        var stopwatch = Stopwatch.StartNew();
        await next(context);
        stopwatch.Stop();

        await tracer.TraceAsync(
            $"HTTP {context.Response.StatusCode} ← {route}",
            TraceKinds.HttpResponse,
            detail: new($"Cevap {stopwatch.ElapsedMilliseconds} ms sonra döndü.",
                $"Response returned after {stopwatch.ElapsedMilliseconds} ms."),
            payload: new
            {
                method = request.Method,
                path = request.Path.Value,
                status = context.Response.StatusCode,
                durationMs = stopwatch.ElapsedMilliseconds
            },
            callerFile: "",
            callerLine: 0);
    }
}
