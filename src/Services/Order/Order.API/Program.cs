using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Order.API.Endpoints;
using Order.Infrastructure;
using Order.Infrastructure.Persistence;
using Shared.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSharedSerilog("Order.API");

builder.Services.AddSharedOpenTelemetry("Order.API");
builder.Services.AddSimulationTracing(builder.Configuration, "order");
builder.Services.AddOrderInfrastructure(builder.Configuration);
builder.Services.AddOrderMessaging(builder.Configuration);
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var connectionString = builder.Configuration.GetConnectionString("Database")
    ?? throw new InvalidOperationException("Database connection string is not configured.");

builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString);

var app = builder.Build();

app.UseSharedInfrastructure();
app.UseSimulationTracing();
app.MapOrderEndpoints();
app.MapHealthChecks("/health");

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<OrderDbContext>();
    await context.Database.MigrateAsync();
}

app.Run();
