using MassTransit;
using Shared.Contracts.Simulation;

namespace Simulator.Web.Tracing;

public sealed class TraceEventConsumer(TraceHub hub) : IConsumer<TraceEvent>
{
    public Task Consume(ConsumeContext<TraceEvent> context)
    {
        hub.Publish(context.Message);
        return Task.CompletedTask;
    }
}
