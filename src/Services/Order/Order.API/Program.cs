using Microsoft.EntityFrameworkCore;
using Order.API.Endpoints;
using Order.Infrastructure;
using Order.Infrastructure.Consumers;
using Order.Infrastructure.Persistence;
using Shared.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSharedSerilog("Order.API");

builder.Services.AddSharedOpenTelemetry("Order.API");
builder.Services.AddOrderInfrastructure(builder.Configuration);
builder.Services.AddSharedMassTransit(builder.Configuration, bus =>
{
    bus.AddConsumer<BasketCheckoutConsumer>();
});

var connectionString = builder.Configuration.GetConnectionString("Database")
    ?? throw new InvalidOperationException("Database connection string is not configured.");

builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString);

var app = builder.Build();

app.UseSharedInfrastructure();
app.MapOrderEndpoints();
app.MapHealthChecks("/health");

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<OrderDbContext>();
    await context.Database.MigrateAsync();
}

app.Run();
