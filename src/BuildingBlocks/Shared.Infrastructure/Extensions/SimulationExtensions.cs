using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Shared.Infrastructure.Simulation;

namespace Shared.Infrastructure.Extensions;

public static class SimulationExtensions
{
    /// <summary>
    /// Servisi simülatöre bağlar. "Simulation:Enabled=false" ile tamamen kapatılabilir.
    /// Publish/consume observer'ları AddSharedMassTransit kaydeder; bu metot önce çağrılmalıdır.
    /// </summary>
    public static IServiceCollection AddSimulationTracing(
        this IServiceCollection services,
        IConfiguration configuration,
        string serviceId)
    {
        services.AddOptions<SimulationOptions>()
            .Bind(configuration.GetSection(SimulationOptions.SectionName))
            .Configure(options => options.ServiceId = serviceId);

        services.AddSingleton<SimulationTraceQueue>();
        services.AddSingleton<ISimulationTracer, SimulationTracer>();
        services.AddHostedService<SimulationTracePublisher>();
        return services;
    }

    public static WebApplication UseSimulationTracing(this WebApplication app)
    {
        app.UseMiddleware<SimulationHttpTraceMiddleware>();
        return app;
    }
}
