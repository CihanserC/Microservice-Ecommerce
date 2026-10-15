using Shared.Contracts.Simulation;

namespace Shared.Infrastructure.Simulation;

/// <summary>Testlerde ve izlemenin istenmediği yerlerde kullanılan boş tracer.</summary>
public sealed class NullSimulationTracer : ISimulationTracer
{
    public static readonly NullSimulationTracer Instance = new();

    public Task TraceAsync(
        TraceText title,
        string kind = TraceKinds.Step,
        TraceText? detail = null,
        Guid? orderId = null,
        object? payload = null,
        string? messageType = null,
        string? fromState = null,
        string? toState = null,
        string callerFile = "",
        int callerLine = 0) => Task.CompletedTask;
}
