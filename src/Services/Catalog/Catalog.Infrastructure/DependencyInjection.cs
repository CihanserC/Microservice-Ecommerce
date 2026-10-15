using Catalog.Infrastructure.Consumers;
using Catalog.Infrastructure.Persistence;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Shared.Infrastructure.Extensions;

namespace Catalog.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddCatalogInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Database")
            ?? throw new InvalidOperationException("Database connection string is not configured.");

        services.AddDbContext<CatalogDbContext>(options =>
            options.UseNpgsql(connectionString));

        return services;
    }

    /// <summary>
    /// Catalog saga'ya stok katılımcısı olarak bağlanır: ReserveStock ve ReleaseStock komutlarını dinler.
    /// Her consumer EF transactional outbox içinde çalışır; stok değişikliği ile yayınlanan olay
    /// ya birlikte kaydedilir ya da hiç kaydedilmez.
    /// </summary>
    public static IServiceCollection AddCatalogMessaging(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSharedMassTransit(configuration, bus =>
        {
            bus.AddEntityFrameworkOutbox<CatalogDbContext>(outbox =>
            {
                outbox.UsePostgres();
            });

            bus.AddConfigureEndpointsCallback((context, _, endpoint) =>
                endpoint.UseEntityFrameworkOutbox<CatalogDbContext>(context));

            bus.AddConsumer<ReserveStockConsumer>();
            bus.AddConsumer<ReleaseStockConsumer>();
        });

        return services;
    }

    public static async Task MigrateCatalogDatabaseAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
        await context.Database.MigrateAsync();
        await CatalogSeeder.SeedAsync(context);
    }
}
