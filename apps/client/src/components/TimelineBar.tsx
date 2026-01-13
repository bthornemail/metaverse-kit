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
  autoPlay: boolean;
  setAutoPlay: (v: boolean) => void;
  mode: 'fps' | 'eps';
  setMode: (m: 'fps' | 'eps') => void;
  fps: number;
  setFps: (v: number) => void;
  eps: number;
  setEps: (v: number) => void;
  markers: Array<{ id: string; pct: number; label: string; type: 'cut' | 'keyframe' | 'beat' | 'loop-in' | 'loop-out' }>;
  onAddMarker: () => void;
  onSelectMarker: (id: string) => void;
  onMoveMarker: (id: string, pct: number) => void;
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
  autoPlay,
  setAutoPlay,
  mode,
  setMode,
  fps,
  setFps,
  eps,
  setEps,
  markers,
  onAddMarker,
  onSelectMarker,
  onMoveMarker,
}: TimelineBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<string | null>(null);

  function clampPct(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  function getPct(e: React.PointerEvent) {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    return clampPct((e.clientX - rect.left) / rect.width);
  }

  function markerColor(type: 'cut' | 'keyframe' | 'beat' | 'loop-in' | 'loop-out') {
    switch (type) {
      case 'keyframe':
        return '#7bdff2';
      case 'beat':
        return '#ffd166';
      case 'loop-in':
        return '#8ef6a0';
      case 'loop-out':
        return '#ff9b85';
      default:
        return '#ffb347';
    }
  }

  function handlePointer(e: React.PointerEvent) {
    if (disabled) return;
    const pct = getPct(e);
    if (pct === undefined) return;
    onChange(pct);
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
        onPointerMove={(e) => {
          if (disabled) return;
          const pct = getPct(e);
          if (pct === undefined) return;
          if (e.buttons === 1) {
            onChange(pct);
          }
        }}
        onPointerUp={(e) => {
          draggingRef.current = null;
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
        {markers.map((m) => (
          <div
            key={m.id}
            title={m.label}
            onClick={(e) => {
              e.stopPropagation();
              onChange(m.pct);
              onSelectMarker(m.id);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (disabled) return;
              draggingRef.current = m.id;
              (e.target as Element).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (disabled) return;
              if (draggingRef.current !== m.id) return;
              const pct = getPct(e);
              if (pct === undefined) return;
              onMoveMarker(m.id, pct);
              onChange(pct);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              draggingRef.current = null;
              (e.target as Element).releasePointerCapture(e.pointerId);
            }}
            style={{
              position: 'absolute',
              left: `calc(${m.pct * 100}% - 1px)`,
              top: 0,
              bottom: 0,
              width: '2px',
              background: markerColor(m.type),
              opacity: 0.9,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          />
        ))}
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
        <button
          onClick={onAddMarker}
          disabled={disabled}
          style={{
            padding: '6px 10px',
            background: '#222',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '12px',
          }}
        >
          Add Marker
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
          Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'fps' | 'eps')}
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
            <option value="fps">FPS</option>
            <option value="eps">Events/s</option>
          </select>
        </label>
        {mode === 'fps' ? (
          <label style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace' }}>
            FPS
            <select
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
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
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </label>
        ) : (
          <label style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace' }}>
            EPS
            <select
              value={eps}
              onChange={(e) => setEps(Number(e.target.value))}
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
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </label>
        )}
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
        <label style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace' }}>
          <input
            type="checkbox"
            checked={autoPlay}
            onChange={(e) => setAutoPlay(e.target.checked)}
            disabled={disabled}
            style={{ marginRight: '6px' }}
          />
          Auto
        </label>
      </div>
    </div>
  );
}
