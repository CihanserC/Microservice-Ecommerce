using Payment.API.Models;
using Payment.API.Services;

namespace Payment.API.Endpoints;

public static class PaymentEndpoints
{
    public static void MapPaymentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/payments").WithTags("Payments");

        group.MapGet("/", (PaymentSimulator simulator) => Results.Ok(simulator.List()));

        group.MapGet("/settings", (PaymentSimulator simulator) => Results.Ok(simulator.Settings));

        // Simülatör arayüzü bu uçla "ödeme başarısız olsun" gibi senaryoları seçer.
        group.MapPut("/settings", (PaymentSettings settings, PaymentSimulator simulator) =>
            Results.Ok(simulator.UpdateSettings(settings)));
    }
}
