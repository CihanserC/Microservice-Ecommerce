using Shared.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSharedSerilog("Gateway.API");

builder.Services.AddSharedOpenTelemetry("Gateway.API");
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseSharedInfrastructure();
app.MapReverseProxy();
app.MapHealthChecks("/health");

app.Run();
