import type { TileState } from '@metaverse-kit/shadow-canvas';
import { getLiveNodes, getStateStats } from '@metaverse-kit/shadow-canvas';

interface StatusBarProps {
  tileState: TileState;
  viewport: { offsetX: number; offsetY: number; scale: number };
}

export default function StatusBar({ tileState, viewport }: StatusBarProps) {
  const stats = getStateStats(tileState);
  const liveNodes = getLiveNodes(tileState);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '12px 16px',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)',
        border: '1px solid #333',
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#aaa',
        minWidth: '200px',
      }}
    >
      <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
        Tile: {tileState.tile_id}
      </div>
      <div>Nodes: {stats.liveNodes} live, {stats.deletedNodes} deleted</div>
      <div>Links: {stats.totalLinks}</div>
      <div>Zoom: {(viewport.scale * 100).toFixed(0)}%</div>
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
        <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>
          Controls:
        </div>
        <div style={{ color: '#888', fontSize: '10px' }}>
          • Mouse wheel: zoom
        </div>
        <div style={{ color: '#888', fontSize: '10px' }}>
          • Drag (select mode): pan
        </div>
        <div style={{ color: '#888', fontSize: '10px' }}>
          • Drag (rectangle): draw
        </div>
        <div style={{ color: '#888', fontSize: '10px' }}>
          • Move mouse: presence cursor
        </div>
        <div style={{ color: '#888', fontSize: '10px' }}>
          • Timeline: scrub history
        </div>
        <div style={{ color: '#888', fontSize: '10px' }}>
          • 2D/3D toggle: view mode
        </div>
        <div style={{ color: '#888', fontSize: '10px' }}>
          • 3D: drag to orbit, scroll to zoom
        </div>
      </div>
    </div>
  );
}
