import type { NarrativeBeat } from '../narrative/series';

interface NarrativeListProps {
  beats: NarrativeBeat[];
  activeId: string;
}

export default function NarrativeList({ beats, activeId }: NarrativeListProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0a0a0a',
        color: '#ddd',
        padding: '20px',
        overflow: 'auto',
        fontFamily: 'serif',
        fontSize: '14px',
      }}
    >
      <div style={{ marginBottom: '12px', color: '#888', fontFamily: 'monospace' }}>
        Narrative Beats: {beats.length}
      </div>
      {beats.map((beat) => (
        <div
          key={beat.id}
          style={{
            borderBottom: '1px solid #222',
            padding: '12px 0',
            color: beat.id === activeId ? '#ffd166' : '#ddd',
          }}
        >
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#888' }}>
            {beat.mode}
          </div>
          <div style={{ fontSize: '16px', marginBottom: '6px' }}>{beat.title}</div>
          <div style={{ color: '#aaa' }}>{beat.text}</div>
          <div style={{ color: '#666', fontFamily: 'monospace', marginTop: '6px' }}>
            roles: {beat.roles.join(', ')}
          </div>
        </div>
      ))}
    </div>
  );
}
