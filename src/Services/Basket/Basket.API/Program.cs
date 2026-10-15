using Basket.API.Endpoints;
using Basket.API.Services;
using Shared.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSharedSerilog("Basket.API");

builder.Services.AddSharedOpenTelemetry("Basket.API");
builder.Services.AddSimulationTracing(builder.Configuration, "basket");
builder.Services.AddSharedMassTransit(builder.Configuration);

var redisConnection = builder.Configuration.GetConnectionString("Redis")
    ?? throw new InvalidOperationException("Redis connection string is not configured.");

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = redisConnection;
});

builder.Services.AddSingleton<BasketService>();

builder.Services.AddHealthChecks()
    .AddRedis(redisConnection);

var app = builder.Build();

app.UseSharedInfrastructure();
app.UseSimulationTracing();
app.MapBasketEndpoints();
app.MapHealthChecks("/health");

app.Run();
