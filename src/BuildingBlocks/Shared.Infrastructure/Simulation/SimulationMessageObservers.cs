using MassTransit;
using Shared.Contracts.Simulation;

namespace Shared.Infrastructure.Simulation;

/// <summary>
/// Servisin yayınladığı her mesajı otomatik izler (servis → RabbitMQ oku).
/// İş koduna tek satır eklemeden bütün publish trafiği simülatörde görünür.
/// </summary>
public sealed class SimulationPublishObserver(ISimulationTracer tracer) : IPublishObserver
{
    public Task PrePublish<T>(PublishContext<T> context) where T : class => Task.CompletedTask;

    public Task PostPublish<T>(PublishContext<T> context) where T : class
    {
        if (context.Message is TraceEvent)
            return Task.CompletedTask;

        var messageType = typeof(T).Name;
        return tracer.TraceAsync(
            $"{messageType} yayınlandı",
            TraceKinds.Publish,
            detail: "Mesaj RabbitMQ exchange'ine bırakıldı. Yayınlayan, kimin dinlediğini bilmez.",
            orderId: MessageInspector.TryGetOrderId(context.Message),
            payload: context.Message,
            messageType: messageType,
            callerFile: "",
            callerLine: 0);
    }

    public Task PublishFault<T>(PublishContext<T> context, Exception exception) where T : class
    {
        if (context.Message is TraceEvent)
            return Task.CompletedTask;

        return tracer.TraceAsync(
            $"{typeof(T).Name} yayınlanamadı",
            TraceKinds.Error,
            detail: exception.Message,
            orderId: MessageInspector.TryGetOrderId(context.Message),
            messageType: typeof(T).Name,
            callerFile: "",
            callerLine: 0);
    }
}

/// <summary>Servisin tükettiği her mesajı otomatik izler (RabbitMQ → servis oku).</summary>
public sealed class SimulationConsumeObserver(ISimulationTracer tracer) : IConsumeObserver
{
    public Task PreConsume<T>(ConsumeContext<T> context) where T : class
    {
        if (context.Message is TraceEvent)
            return Task.CompletedTask;

        var messageType = typeof(T).Name;
        return tracer.TraceAsync(
            $"{messageType} alındı",
            TraceKinds.Consume,
            detail: $"Kuyruk: {context.ReceiveContext.InputAddress.AbsolutePath.Trim('/')}",
            orderId: MessageInspector.TryGetOrderId(context.Message),
            payload: context.Message,
            messageType: messageType,
            callerFile: "",
            callerLine: 0);
    }

    public Task PostConsume<T>(ConsumeContext<T> context) where T : class => Task.CompletedTask;

    public Task ConsumeFault<T>(ConsumeContext<T> context, Exception exception) where T : class
    {
        if (context.Message is TraceEvent)
            return Task.CompletedTask;

        return tracer.TraceAsync(
            $"{typeof(T).Name} işlenirken hata",
            TraceKinds.Error,
            detail: $"{exception.GetType().Name}: {exception.Message}. Retry politikası mesajı yeniden deneyecek; denemeler biterse mesaj _error kuyruğuna düşer.",
            orderId: MessageInspector.TryGetOrderId(context.Message),
            messageType: typeof(T).Name,
            callerFile: "",
            callerLine: 0);
    }
}

internal static class MessageInspector
{
    public static Guid? TryGetOrderId(object message) =>
        message.GetType().GetProperty("OrderId")?.GetValue(message) as Guid?;
}
