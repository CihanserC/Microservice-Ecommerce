using System.Text.Json.Serialization;
using Payment.API.Consumers;
using Payment.API.Endpoints;
using Payment.API.Services;
using Shared.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSharedSerilog("Payment.API");

builder.Services.AddSharedOpenTelemetry("Payment.API");
builder.Services.AddSimulationTracing(builder.Configuration, "payment");
builder.Services.AddSharedMassTransit(builder.Configuration, bus =>
{
    bus.AddConsumer<ProcessPaymentConsumer>();
});

builder.Services.AddSingleton<PaymentSimulator>();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseSharedInfrastructure();
app.UseSimulationTracing();
app.MapPaymentEndpoints();
app.MapHealthChecks("/health");

app.Run();
