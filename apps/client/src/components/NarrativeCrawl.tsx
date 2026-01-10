import type { NarrativeBeat } from '../narrative/series';

interface NarrativeCrawlProps {
  beat: NarrativeBeat;
  progress: number;
}

export default function NarrativeCrawl({ beat, progress }: NarrativeCrawlProps) {
  const isCovenant = beat.mode === 'covenant';
  const speed = isCovenant ? 0.6 : 1.0;
  const translateY = (1 - progress) * 220 * speed;
  const scale = 1 - progress * 0.2;
  const opacity = Math.max(0, 1 - progress * 1.1);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        color: isCovenant ? '#f2e8c9' : '#d0d0d0',
        fontFamily: 'serif',
        letterSpacing: '0.04em',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          transform: `translateY(${-translateY}px) scale(${scale})`,
          opacity,
          transition: 'transform 0.05s linear, opacity 0.05s linear',
        }}
      >
        <div style={{ fontSize: '18px', marginBottom: '8px', textTransform: 'uppercase' }}>
          {beat.title}
        </div>
        <div style={{ fontSize: '14px', lineHeight: 1.6 }}>{beat.text}</div>
      </div>
    </div>
  );
}
