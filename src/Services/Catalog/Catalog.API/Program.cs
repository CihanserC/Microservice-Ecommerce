using Catalog.API.Endpoints;
using Catalog.Infrastructure;
using Catalog.Infrastructure.Products.Commands;
using Shared.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSharedSerilog("Catalog.API");

builder.Services.AddSharedOpenTelemetry("Catalog.API");
builder.Services.AddSimulationTracing(builder.Configuration, "catalog");
builder.Services.AddCatalogInfrastructure(builder.Configuration);
builder.Services.AddCatalogMessaging(builder.Configuration);
builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(typeof(CreateProductHandler).Assembly));

var connectionString = builder.Configuration.GetConnectionString("Database")
    ?? throw new InvalidOperationException("Database connection string is not configured.");

builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString);

var app = builder.Build();

app.UseSharedInfrastructure();
app.UseSimulationTracing();
app.MapProductEndpoints();
app.MapHealthChecks("/health");

await app.Services.MigrateCatalogDatabaseAsync();

app.Run();
