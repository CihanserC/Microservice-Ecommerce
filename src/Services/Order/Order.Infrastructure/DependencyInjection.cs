using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Order.Infrastructure.Consumers;
using Order.Infrastructure.Persistence;
using Order.Infrastructure.Saga;
using Shared.Infrastructure.Extensions;

namespace Order.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddOrderInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Database")
            ?? throw new InvalidOperationException("Database connection string is not configured.");

        services.AddDbContext<OrderDbContext>(options =>
            options.UseNpgsql(connectionString));

        return services;
    }

    /// <summary>
    /// Order servisi iki rol üstlenir:
    ///  - Sipariş kaydı: BasketCheckoutEvent → CustomerOrder, saga sonucu → durum güncellemesi.
    ///  - Saga orkestratörü: OrderStateMachine, durumunu OrderSagaStates tablosunda tutar.
    /// </summary>
    public static IServiceCollection AddOrderMessaging(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSharedMassTransit(configuration, bus =>
        {
            bus.AddEntityFrameworkOutbox<OrderDbContext>(outbox =>
            {
                outbox.UsePostgres();
            });

            bus.AddConfigureEndpointsCallback((context, _, endpoint) =>
                endpoint.UseEntityFrameworkOutbox<OrderDbContext>(context));

            bus.AddConsumer<BasketCheckoutConsumer>();
            bus.AddConsumer<OrderOutcomeConsumer>();

            bus.AddSagaStateMachine<OrderStateMachine, OrderState>()
                .EntityFrameworkRepository(repository =>
                {
                    // Aynı sipariş için iki mesaj aynı anda gelirse satır kilitlenir (SELECT ... FOR UPDATE).
                    repository.ConcurrencyMode = ConcurrencyMode.Pessimistic;
                    repository.ExistingDbContext<OrderDbContext>();
                    repository.UsePostgres();
                });
        });

        return services;
    }
}
