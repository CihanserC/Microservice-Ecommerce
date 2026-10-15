using MassTransit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Shared.Infrastructure.Simulation;

namespace Shared.Infrastructure.Extensions;

public static class MassTransitExtensions
{
    public static IServiceCollection AddSharedMassTransit(
        this IServiceCollection services,
        IConfiguration configuration,
        Action<IBusRegistrationConfigurator>? configureConsumers = null)
    {
        var rabbitMqHost = configuration["RabbitMq:Host"] ?? "localhost";
        var rabbitMqUsername = configuration["RabbitMq:Username"] ?? "guest";
        var rabbitMqPassword = configuration["RabbitMq:Password"] ?? "guest";

        services.AddMassTransit(busConfigurator =>
        {
            configureConsumers?.Invoke(busConfigurator);

            // Tracer kayıtlıysa (AddSimulationTracing) her publish/consume simülatörde görünür.
            if (services.Any(d => d.ServiceType == typeof(ISimulationTracer)))
            {
                busConfigurator.AddPublishObserver<SimulationPublishObserver>();
                busConfigurator.AddConsumeObserver<SimulationConsumeObserver>();
            }

            busConfigurator.UsingRabbitMq((context, cfg) =>
            {
                cfg.Host(rabbitMqHost, "/", h =>
                {
                    h.Username(rabbitMqUsername);
                    h.Password(rabbitMqPassword);
                });

                // Geçici hatalar (eşzamanlı stok güncellemesi, kısa DB kopması) mesajı kaybettirmesin.
                // Denemeler tükenirse mesaj <kuyruk>_error kuyruğuna düşer.
                cfg.UseMessageRetry(r => r.Intervals(100, 500, 1000, 2000));

                cfg.ConfigureEndpoints(context);
            });
        });

        return services;
    }
}
