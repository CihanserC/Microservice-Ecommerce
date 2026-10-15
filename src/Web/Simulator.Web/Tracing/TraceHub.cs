using System.Threading.Channels;
using Shared.Contracts.Simulation;

namespace Simulator.Web.Tracing;

/// <summary>
/// Servislerden gelen izleri tarayıcılara dağıtır.
/// Son izler bir halka tamponda tutulur; sayfa sonradan açılsa bile geçmiş görülebilir.
/// </summary>
public sealed class TraceHub
{
    private const int HistoryLimit = 1000;

    private readonly Lock _gate = new();
    private readonly LinkedList<TraceEvent> _history = new();
    private readonly List<Channel<TraceEvent>> _subscribers = [];

    public void Publish(TraceEvent traceEvent)
    {
        lock (_gate)
        {
            _history.AddLast(traceEvent);
            while (_history.Count > HistoryLimit)
                _history.RemoveFirst();

            foreach (var subscriber in _subscribers)
                subscriber.Writer.TryWrite(traceEvent);
        }
    }

    public IReadOnlyList<TraceEvent> History(int take)
    {
        lock (_gate)
            return _history.Skip(Math.Max(0, _history.Count - take)).ToList();
    }

    public void Clear()
    {
        lock (_gate)
            _history.Clear();
    }

    public Channel<TraceEvent> Subscribe()
    {
        // Yavaş bir tarayıcı servisleri yavaşlatmasın: dolarsa en eski iz düşer.
        var channel = Channel.CreateBounded<TraceEvent>(new BoundedChannelOptions(500)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true
        });

        lock (_gate)
            _subscribers.Add(channel);

        return channel;
    }

    public void Unsubscribe(Channel<TraceEvent> channel)
    {
        lock (_gate)
            _subscribers.Remove(channel);

        channel.Writer.TryComplete();
    }
}
