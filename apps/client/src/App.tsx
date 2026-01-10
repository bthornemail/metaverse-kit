import { useEffect, useState } from 'react';
import type { TileState } from '@metaverse-kit/shadow-canvas';
import { buildState } from '@metaverse-kit/shadow-canvas';
import type { WorldEvent, SpaceId, TileId } from '@metaverse-kit/protocol';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';

interface ViewportState {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export default function App() {
  const [spaceId] = useState<SpaceId>('demo');
  const [tileId] = useState<TileId>('z0/x0/y0');
  const [tileState, setTileState] = useState<TileState | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    offsetX: window.innerWidth / 2,
    offsetY: window.innerHeight / 2,
    scale: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'rectangle'>('select');

  // Load tile from server
  useEffect(() => {
    loadTile(spaceId, tileId);
  }, [spaceId, tileId]);

  async function loadTile(space: SpaceId, tile: TileId) {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch tile tip (index)
      const tipRes = await fetch(`/tile_tip?space_id=${space}&tile_id=${tile}`);

      if (!tipRes.ok) {
        if (tipRes.status === 404) {
          // Tile doesn't exist yet - create empty state
          console.log('Tile not found - creating empty state');
          setTileState({ tile_id: tile, nodes: new Map() });
          setIsLoading(false);
          return;
        }
        throw new Error(`Failed to fetch tile tip: ${tipRes.statusText}`);
      }

      const tip = await tipRes.json();
      console.log('Tile tip:', tip);

      // Fetch segments
      const segsRes = await fetch('/segments_since', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ space_id: space, tile_id: tile, after_event: null }),
      });

      if (!segsRes.ok) {
        throw new Error(`Failed to fetch segments: ${segsRes.statusText}`);
      }

      const { segments } = await segsRes.json();
      console.log(`Fetched ${segments.length} segments`);

      // Fetch and parse events from all segments
      const events: WorldEvent[] = [];
      for (const seg of segments) {
        const data = await fetch(`/object/${encodeURIComponent(seg.hash)}`).then((r) =>
          r.text()
        );

        // Parse JSONL
        for (const line of data.trim().split('\n')) {
          if (line) {
            events.push(JSON.parse(line));
          }
        }
      }

      console.log(`Loaded ${events.length} events`);

      // Build state from events
      const state = buildState(tile, null, events);
      console.log('Built state:', state);

      setTileState(state);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error loading tile:', err);
      setError(err.message);
      setIsLoading(false);
    }
  }

  async function createRectangle(x: number, y: number, width: number, height: number) {
    if (!tileState) return;

    // Create a create_node event
    const event: WorldEvent = {
      event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      space_id: spaceId,
      layer_id: 'layout' as const,
      actor_id: 'user:client',
      operation: 'create_node' as const,
      scope: {
        realm: 'team' as const,
        authority: 'source' as const,
        boundary: 'interior' as const,
      },
      preserves_invariants: [
        'adjacency' as const,
        'exclusion' as const,
        'consistency' as const,
        'boundary_discipline' as const,
        'authority_nontransfer' as const,
      ],
      previous_events: [],
      tile: tileId,
      node_id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      kind: 'primitive.rectangle',
      transform: {
        position: [x, y, 0],
        rotation_quat: [0, 0, 0, 1],
        scale: [width, height, 1],
      },
      properties: {
        color: '#ffffff',
        label: 'Rectangle',
      },
    };

    try {
      // Send to server
      const res = await fetch('/append_events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          space_id: spaceId,
          tile_id: tileId,
          events: [event],
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to append event');
      }

      // Update local state
      const newState = buildState(tileState.tile_id, null, [
        ...Array.from(tileState.nodes.values()).map((n) => ({
          event_id: 'existing',
          timestamp: 0,
          space_id: spaceId,
          layer_id: 'layout' as const,
          actor_id: 'system',
          operation: 'create_node' as const,
          scope: { realm: 'team' as const, authority: 'source' as const, boundary: 'interior' as const },
          preserves_invariants: ['adjacency' as const, 'exclusion' as const, 'consistency' as const, 'boundary_discipline' as const, 'authority_nontransfer' as const],
          previous_events: [],
          tile: tileId,
          node_id: n.node_id,
          kind: n.kind,
          transform: n.transform,
          properties: n.properties,
        })),
        event,
      ]);

      setTileState(newState);
      console.log('Created rectangle:', event.node_id);
    } catch (err: any) {
      console.error('Error creating rectangle:', err);
      alert(`Failed to create rectangle: ${err.message}`);
    }
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#888'
      }}>
        Loading tile {tileId}...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#ff4444',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div>Error: {error}</div>
        <button
          onClick={() => loadTile(spaceId, tileId)}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer',
            background: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '4px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!tileState) {
    return null;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas
        tileState={tileState}
        viewport={viewport}
        setViewport={setViewport}
        activeTool={activeTool}
        onCreateRectangle={createRectangle}
      />
      <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} />
      <StatusBar tileState={tileState} viewport={viewport} />
    </div>
  );
}
