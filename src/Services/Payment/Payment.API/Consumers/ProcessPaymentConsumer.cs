using MassTransit;
using Payment.API.Models;
using Payment.API.Services;
using Shared.Contracts.Saga;
using Shared.Contracts.Simulation;
using Shared.Infrastructure.Simulation;

namespace Payment.API.Consumers;

/// <summary>
/// Saga'nın son adımı. Payment, saga'nın varlığından habersizdir: bir komut alır, bir olay yayınlar.
/// Bu yüzden aynı servis başka bir süreçte (ör. abonelik yenileme) aynen kullanılabilir.
/// </summary>
public sealed class ProcessPaymentConsumer(
    PaymentSimulator simulator,
    ISimulationTracer tracer) : IConsumer<ProcessPaymentCommand>
{
    public async Task Consume(ConsumeContext<ProcessPaymentCommand> context)
    {
        var message = context.Message;

        // Idempotency: aynı sipariş için ikinci tahsilat yapılmaz, ilk sonuç tekrar bildirilir.
        var existing = simulator.Find(message.OrderId);
        if (existing is not null)
        {
            await tracer.TraceAsync(
                new("Bu sipariş zaten işlenmiş, ikinci kez tahsil edilmedi",
                    "This order was already processed, not charged a second time"),
                detail: new("Tekrar gelen komut için önceki sonuç yeniden yayınlanıyor.",
                    "The earlier result is published again for the repeated command."),
                orderId: message.OrderId);
            await PublishOutcome(context, existing);
            return;
        }

        var settings = simulator.Settings;
        await tracer.TraceAsync(
            new($"Bankaya gidiliyor ({settings.DelayMs} ms)", $"Calling the bank ({settings.DelayMs} ms)"),
            detail: new($"Mod: {settings.Mode}, limit: {settings.Limit:N2} ₺. Bu sürede saga AwaitingPayment durumunda bekler.",
                $"Mode: {settings.Mode}, limit: {settings.Limit:N2} ₺. Meanwhile the saga waits in AwaitingPayment."),
            orderId: message.OrderId,
            payload: settings);

        await Task.Delay(settings.DelayMs, context.CancellationToken);

        var failureReason = simulator.Decide(message.Amount);
        var record = simulator.Record(new PaymentRecord(
            PaymentId: Guid.NewGuid(),
            OrderId: message.OrderId,
            UserName: message.UserName,
            Amount: message.Amount,
            Succeeded: failureReason is null,
            FailureReason: failureReason,
            ProcessedAt: DateTime.UtcNow));

        await tracer.TraceAsync(
            record.Succeeded ? new TraceText("Ödeme onaylandı", "Payment approved") : new TraceText("Ödeme reddedildi", "Payment declined"),
            record.Succeeded ? TraceKinds.Step : TraceKinds.Error,
            detail: record.FailureReason ?? new TraceText($"{record.Amount:N2} ₺ tahsil edildi.", $"{record.Amount:N2} ₺ charged."),
            orderId: message.OrderId,
            payload: record);

        await PublishOutcome(context, record);
    }

    private static Task PublishOutcome(ConsumeContext context, PaymentRecord record) =>
        record.Succeeded
            ? context.Publish(new PaymentCompletedEvent { OrderId = record.OrderId, PaymentId = record.PaymentId })
            : context.Publish(new PaymentFailedEvent { OrderId = record.OrderId, Reason = record.FailureReason! });
}
