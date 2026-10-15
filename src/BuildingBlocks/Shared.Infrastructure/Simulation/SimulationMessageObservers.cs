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
            new($"{messageType} yayınlandı", $"{messageType} published"),
            TraceKinds.Publish,
            detail: new("Mesaj RabbitMQ exchange'ine bırakıldı. Yayınlayan, kimin dinlediğini bilmez.",
                "The message was handed to a RabbitMQ exchange. The publisher does not know who is listening."),
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
            new($"{typeof(T).Name} yayınlanamadı", $"{typeof(T).Name} could not be published"),
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
        var queue = context.ReceiveContext.InputAddress.AbsolutePath.Trim('/');
        return tracer.TraceAsync(
            new($"{messageType} alındı", $"{messageType} received"),
            TraceKinds.Consume,
            detail: new($"Kuyruk: {queue}", $"Queue: {queue}"),
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
            new($"{typeof(T).Name} işlenirken hata", $"Error while handling {typeof(T).Name}"),
            TraceKinds.Error,
            detail: new(
                $"{exception.GetType().Name}: {exception.Message}. Retry politikası mesajı yeniden deneyecek; denemeler biterse mesaj _error kuyruğuna düşer.",
                $"{exception.GetType().Name}: {exception.Message}. The retry policy will redeliver the message; once retries run out it moves to the _error queue."),
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
