import { useEffect, useRef, useState } from 'react';
import type { StencilPack } from '../editor/stencils';

interface PalettePanelProps {
  packs: StencilPack[];
  activePackId: string;
  setActivePackId: (id: string) => void;
  activeStencilId: string | null;
  setActiveStencilId: (id: string) => void;
  activeTool: 'select' | 'rectangle' | 'connect' | 'pan';
  setActiveTool: (tool: 'select' | 'rectangle' | 'connect' | 'pan') => void;
  activeRelation: string;
  setActiveRelation: (relation: string) => void;
  activeRoute: 'orth' | 'straight' | 'bezier';
  setActiveRoute: (route: 'orth' | 'straight' | 'bezier') => void;
  pinned?: boolean;
  onTogglePin?: () => void;
}

export default function PalettePanel({
  packs,
  activePackId,
  setActivePackId,
  activeStencilId,
  setActiveStencilId,
  activeTool,
  setActiveTool,
  activeRelation,
  setActiveRelation,
  activeRoute,
  setActiveRoute,
  pinned = false,
  onTogglePin,
}: PalettePanelProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const touchStartX = useRef<number | null>(null);
  const pack = packs.find((p) => p.id === activePackId) ?? packs[0];

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(query.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isMobile) setIsOpen(true);
  }, [isMobile]);

  useEffect(() => {
    if (pinned) setIsOpen(true);
  }, [pinned]);

  const visible = !isMobile || isOpen || pinned;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 'clamp(180px, 18vw, 260px)',
        background: '#0d0d0d',
        borderRight: '1px solid #222',
        padding: '14px',
        color: '#ccc',
        fontFamily: 'monospace',
        fontSize: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transform: visible ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        zIndex: 15,
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const endX = e.changedTouches[0]?.clientX ?? 0;
        const dx = endX - touchStartX.current;
        if (dx > 40) setIsOpen(true);
        if (dx < -40 && !pinned) setIsOpen(false);
        touchStartX.current = null;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: '#8aa', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Palette</span>
          <span
            title={pinned ? 'Pinned' : 'Unpinned'}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: pinned ? '#44cc88' : '#333',
              border: '1px solid #222',
              display: 'inline-block',
            }}
          />
        </div>
        {onTogglePin ? (
          <button
            onClick={() => {
              onTogglePin();
              if (!pinned) setIsOpen(true);
            }}
            style={{
              padding: '4px 6px',
              fontSize: '10px',
              background: pinned ? '#224' : '#1b1b1b',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {pinned ? 'Unpin' : 'Pin'}
          </button>
        ) : null}
      </div>
      {isMobile ? (
        <button
          onClick={() => setIsOpen((v) => !v)}
          style={{
            position: 'absolute',
            right: '-18px',
            top: '20px',
            width: '18px',
            height: '60px',
            background: '#111',
            color: '#888',
            border: '1px solid #333',
            borderRadius: '0 6px 6px 0',
            cursor: 'pointer',
          }}
        >
          {visible ? '‹' : '›'}
        </button>
      ) : null}
      <div>
        <div style={{ marginBottom: '6px', color: '#8aa' }}>Tools</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(['select', 'pan', 'rectangle', 'connect'] as const).map((tool) => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool)}
              style={{
                padding: '6px 10px',
                background: activeTool === tool ? '#4488ff' : '#1b1b1b',
                color: activeTool === tool ? '#fff' : '#aaa',
                border: '1px solid ' + (activeTool === tool ? '#4488ff' : '#333'),
                borderRadius: '6px',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tool === 'rectangle' ? 'place' : tool}
            </button>
          ))}
        </div>
        {activeTool === 'connect' ? (
          <div style={{ marginTop: '8px' }}>
            <label style={{ display: 'block', color: '#888' }}>
              Relation
              <input
                value={activeRelation}
                onChange={(e) => setActiveRelation(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '6px 8px',
                  background: '#111',
                  color: '#ccc',
                  border: '1px solid #333',
                  borderRadius: '6px',
                }}
              />
            </label>
            <label style={{ display: 'block', marginTop: '8px', color: '#888' }}>
              Route
              <select
                value={activeRoute}
                onChange={(e) => setActiveRoute(e.target.value as 'orth' | 'straight' | 'bezier')}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '6px 8px',
                  background: '#111',
                  color: '#ccc',
                  border: '1px solid #333',
                  borderRadius: '6px',
                }}
              >
                <option value="orth">Orthogonal</option>
                <option value="straight">Straight</option>
                <option value="bezier">Bezier</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>
      <div>
        <div style={{ marginBottom: '6px', color: '#8aa' }}>Stencil Pack</div>
        <select
          value={pack.id}
          onChange={(e) => setActivePackId(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            background: '#111',
            color: '#ccc',
            border: '1px solid #333',
            borderRadius: '6px',
          }}
        >
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ overflow: 'auto' }}>
        {pack.groups.map((group) => (
          <div key={group.id} style={{ marginBottom: '12px' }}>
            <div style={{ color: '#777', marginBottom: '6px' }}>{group.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {group.stencils.map((stencil) => (
                <button
                  key={stencil.id}
                  onClick={() => {
                    setActiveStencilId(stencil.id);
                    setActiveTool('rectangle');
                  }}
                  style={{
                    padding: '6px 8px',
                    background: activeStencilId === stencil.id ? '#44cc88' : '#1b1b1b',
                    color: activeStencilId === stencil.id ? '#fff' : '#aaa',
                    border: '1px solid ' + (activeStencilId === stencil.id ? '#44cc88' : '#333'),
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {stencil.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
