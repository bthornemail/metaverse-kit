import { useRef } from 'react';

interface TimelineBarProps {
  value: number; // 0..1
  onChange: (next: number) => void;
  disabled: boolean;
  label: string;
  isPlaying: boolean;
  setPlaying: (v: boolean) => void;
  speed: number;
  setSpeed: (v: number) => void;
  loop: boolean;
  setLoop: (v: boolean) => void;
}

export default function TimelineBar({
  value,
  onChange,
  disabled,
  label,
  isPlaying,
  setPlaying,
  speed,
  setSpeed,
  loop,
  setLoop,
}: TimelineBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  function handlePointer(e: React.PointerEvent) {
    if (disabled) return;
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const next = (e.clientX - rect.left) / rect.width;
    onChange(Math.max(0, Math.min(1, next)));
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '420px',
      }}
    >
      <div style={{ color: '#aaa', fontSize: '11px', fontFamily: 'monospace' }}>{label}</div>
      <div
        ref={barRef}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          handlePointer(e);
        }}
        onPointerMove={handlePointer}
        onPointerUp={(e) => {
          (e.target as Element).releasePointerCapture(e.pointerId);
        }}
        style={{
          position: 'relative',
          height: '22px',
          borderRadius: '6px',
          border: '1px solid #222',
          background: disabled ? '#111' : '#141414',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${value * 100}%`,
            background: 'linear-gradient(90deg, rgba(68,204,136,0.3), rgba(68,204,136,0.05))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `calc(${value * 100}% - 1px)`,
            top: 0,
            bottom: 0,
            width: '2px',
            background: '#44cc88',
            boxShadow: '0 0 8px rgba(68,204,136,0.6)',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => setPlaying(!isPlaying)}
          disabled={disabled}
          style={{
            padding: '6px 10px',
            background: isPlaying ? '#44cc88' : '#222',
            color: isPlaying ? '#fff' : '#aaa',
            border: '1px solid ' + (isPlaying ? '#44cc88' : '#333'),
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '12px',
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <label style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace' }}>
          Speed
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{
              marginLeft: '6px',
              background: '#111',
              color: '#ccc',
              border: '1px solid #333',
              borderRadius: '6px',
              padding: '4px 6px',
              fontSize: '11px',
            }}
            disabled={disabled}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </label>
        <label style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace' }}>
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
            disabled={disabled}
            style={{ marginRight: '6px' }}
          />
          Loop
        </label>
      </div>
    </div>
  );
}
