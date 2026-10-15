using System.Runtime.CompilerServices;
using Shared.Contracts.Simulation;

namespace Shared.Infrastructure.Simulation;

/// <summary>
/// İş kodunun "şu an şunu yaptım" diye simülatöre haber verdiği tek giriş noktası.
/// CallerFilePath/CallerLineNumber sayesinde her iz, onu üreten satıra bağlanır;
/// simülatör arayüzü bu satırı kaynak koddan açıp gösterir.
/// </summary>
public interface ISimulationTracer
{
    Task TraceAsync(
        string title,
        string kind = TraceKinds.Step,
        string? detail = null,
        Guid? orderId = null,
        object? payload = null,
        string? messageType = null,
        string? fromState = null,
        string? toState = null,
        [CallerFilePath] string callerFile = "",
        [CallerLineNumber] int callerLine = 0);
}
