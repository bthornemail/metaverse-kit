import type { WorldEvent } from '@metaverse-kit/protocol';

interface EventListProps {
  events: WorldEvent[];
}

export default function EventList({ events }: EventListProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0a0a0a',
        color: '#ddd',
        padding: '20px',
        overflow: 'auto',
        fontFamily: 'monospace',
        fontSize: '12px',
      }}
    >
      <div style={{ marginBottom: '12px', color: '#888' }}>
        Events: {events.length}
      </div>
      {events.map((ev) => (
        <div
          key={`${ev.event_id}`}
          style={{
            borderBottom: '1px solid #222',
            padding: '8px 0',
          }}
        >
          <div style={{ color: '#aaa' }}>
            {new Date(ev.timestamp).toLocaleTimeString()} · {ev.operation}
          </div>
          <div style={{ color: '#666' }}>
            {ev.actor_id} · {ev.space_id} · {ev.tile}
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#555', margin: '6px 0 0' }}>
            {JSON.stringify(ev, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}
