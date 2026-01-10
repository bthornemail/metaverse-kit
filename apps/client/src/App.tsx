import { useEffect, useMemo, useRef, useState } from 'react';
import type { TileState } from '@metaverse-kit/shadow-canvas';
import { buildState } from '@metaverse-kit/shadow-canvas';
import type { WorldEvent, SpaceId, TileId, PresenceUpdate, Snapshot } from '@metaverse-kit/protocol';
import Canvas from './components/Canvas';
import Canvas3D from './components/Canvas3D';
import Overlay2D from './components/Overlay2D';
import VoxelCanvas from './components/VoxelCanvas';
import EventList from './components/EventList';
import NarrativeCrawl from './components/NarrativeCrawl';
import { NARRATIVE_BEATS } from './narrative/series';
import { narrativeFrame } from './narrative/engine';
import NarrativeList from './components/NarrativeList';
import { DEFAULT_ASSET_PACKS, type SemanticRole, getAssetForRole, type AssetPack } from './semantic/roles';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';

interface ViewportState {
  offsetX: number;
  offsetY: number;
  scale: number;
}

const DB_NAME = 'metaverse-kit';
const DB_VERSION = 1;
const TILE_STORE = 'tileEvents';

type CachedTile = {
  key: string;
  events: WorldEvent[];
  segmentEvents: Record<string, WorldEvent[]>;
  updatedAt: number;
};

function tileKey(space: SpaceId, tile: TileId) {
  return `${space}::${tile}`;
}

function snapshotStorageKey(space: SpaceId, tile: TileId) {
  return `mvk:snapshot:${space}:${tile}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TILE_STORE)) {
        db.createObjectStore(TILE_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readCachedTile(space: SpaceId, tile: TileId): Promise<CachedTile | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(TILE_STORE, 'readonly');
      const store = tx.objectStore(TILE_STORE);
      const req = store.get(tileKey(space, tile));
      req.onsuccess = () => {
        const result = req.result as CachedTile | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        resolve({
          ...result,
          events: Array.isArray(result.events) ? result.events : [],
          segmentEvents: result.segmentEvents ?? {},
        });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function writeCachedTile(
  space: SpaceId,
  tile: TileId,
  events: WorldEvent[],
  segmentEvents: Record<string, WorldEvent[]>
) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(TILE_STORE, 'readwrite');
      const store = tx.objectStore(TILE_STORE);
      store.put({
        key: tileKey(space, tile),
        events,
        segmentEvents,
        updatedAt: Date.now(),
      } satisfies CachedTile);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort cache
  }
}

function readSnapshotFromStorage(space: SpaceId, tile: TileId): Snapshot | null {
  try {
    const raw = localStorage.getItem(snapshotStorageKey(space, tile));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

function writeSnapshotToStorage(space: SpaceId, tile: TileId, snap: Snapshot | null) {
  try {
    if (!snap) {
      localStorage.removeItem(snapshotStorageKey(space, tile));
      return;
    }
    localStorage.setItem(snapshotStorageKey(space, tile), JSON.stringify(snap));
  } catch {
    // best-effort cache
  }
}

export default function App() {
  const [spaceId] = useState<SpaceId>('demo');
  const [tileId] = useState<TileId>('z0/x0/y0');
  const [actorId] = useState(() => `user:${crypto.randomUUID()}`);
  const [tileState, setTileState] = useState<TileState | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    offsetX: window.innerWidth / 2,
    offsetY: window.innerHeight / 2,
    scale: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'rectangle'>('select');
  const [viewMode, setViewMode] = useState<'1d' | '2d' | 'voxel' | '3d'>('2d');
  const [narrativeMode, setNarrativeMode] = useState(false);
  const [semanticRole, setSemanticRole] = useState<SemanticRole>('law');
  const [symbolSet, setSymbolSet] = useState(DEFAULT_ASSET_PACKS[0].id);
  const [assetPacks, setAssetPacks] = useState<AssetPack[]>(DEFAULT_ASSET_PACKS);
  const [isImportingPack, setIsImportingPack] = useState(false);
  const [allEvents, setAllEvents] = useState<WorldEvent[]>([]);
  const [timelinePct, setTimelinePct] = useState(1);
  const [timelineRange, setTimelineRange] = useState<{ min: number; max: number } | null>(null);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceUpdate>>({});
  const presenceSocket = useRef<WebSocket | null>(null);
  const lastPresenceSent = useRef(0);
  const segmentCacheRef = useRef<Record<string, WorldEvent[]>>({});

  // Load tile from server
  useEffect(() => {
    loadTile(spaceId, tileId);
  }, [spaceId, tileId]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/presence`);
    presenceSocket.current = ws;

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'hello', space_id: spaceId, actor_id: actorId }));
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === 'presence' && msg.payload) {
          const presence = msg.payload as PresenceUpdate;
          if (presence.actor_id !== actorId) {
            setPresenceMap((prev) => ({ ...prev, [presence.actor_id]: presence }));
          }
        } else if (msg?.type === 'presence_batch' && Array.isArray(msg.payload)) {
          const batch = msg.payload as Array<{ type: string; payload: PresenceUpdate }>;
          setPresenceMap((prev) => {
            const next = { ...prev };
            for (const item of batch) {
              if (item.payload.actor_id !== actorId) {
                next[item.payload.actor_id] = item.payload;
              }
            }
            return next;
          });
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.addEventListener('close', () => {
      presenceSocket.current = null;
    });

    return () => {
      ws.close();
    };
  }, [actorId, spaceId]);

  const filteredEvents = useMemo(() => {
    if (!timelineRange || allEvents.length === 0) return [];
    const { min, max } = timelineRange;
    const cutoff = min + (max - min) * timelinePct;
    return allEvents.filter((ev) => ev.timestamp <= cutoff);
  }, [allEvents, timelineRange, timelinePct]);

  const narrative = useMemo(() => narrativeFrame(NARRATIVE_BEATS, timelinePct), [timelinePct]);
  const displayState = narrativeMode ? narrative.state : tileState;

  useEffect(() => {
    if (!timelineRange || allEvents.length === 0) return;
    setTileState(buildState(tileId, snapshot, filteredEvents));
  }, [filteredEvents, tileId, timelineRange, snapshot, allEvents.length]);

  useEffect(() => {
    if (allEvents.length === 0) return;
    void writeCachedTile(spaceId, tileId, allEvents, segmentCacheRef.current);
  }, [allEvents, spaceId, tileId]);

  useEffect(() => {
    writeSnapshotToStorage(spaceId, tileId, snapshot);
  }, [snapshot, spaceId, tileId]);

  async function loadTile(space: SpaceId, tile: TileId) {
    try {
      setIsLoading(true);
      setError(null);

      const cached = await readCachedTile(space, tile);
      const cachedSnap = readSnapshotFromStorage(space, tile);
      if (cached?.events?.length) {
        segmentCacheRef.current = cached.segmentEvents ?? {};
        setSnapshot(cachedSnap);
        setAllEvents(cached.events);
        const times = cached.events.map((ev) => ev.timestamp);
        const min = Math.min(...times);
        const max = Math.max(...times);
        setTimelineRange({ min, max });
        setTimelinePct(1);
        setTileState(buildState(tile, cachedSnap, cached.events));
        setIsLoading(false);
      }

      // Fetch tile tip (index)
      const tipRes = await fetch(`/tile_tip?space_id=${space}&tile_id=${tile}`);

      if (!tipRes.ok) {
        if (tipRes.status === 404) {
          // Tile doesn't exist yet - create empty state
          console.log('Tile not found - creating empty state');
          setTileState({ tile_id: tile, nodes: new Map() });
          setAllEvents([]);
          setTimelineRange(null);
          setTimelinePct(1);
          setSnapshot(null);
          setIsLoading(false);
          return;
        }
        throw new Error(`Failed to fetch tile tip: ${tipRes.statusText}`);
      }

      const tip = await tipRes.json();
      console.log('Tile tip:', tip);

      let baseSnapshot: Snapshot | null = null;
      if (tip.last_snapshot) {
        const snapRes = await fetch(`/object/${encodeURIComponent(tip.last_snapshot)}`);
        if (snapRes.ok) {
          baseSnapshot = await snapRes.json();
        } else {
          baseSnapshot = readSnapshotFromStorage(space, tile);
        }
      } else {
        baseSnapshot = readSnapshotFromStorage(space, tile);
      }

      // Fetch segments
      const segsRes = await fetch('/segments_since', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          space_id: space,
          tile_id: tile,
          after_event: tip.snapshot_event ?? null,
        }),
      });

      if (!segsRes.ok) {
        throw new Error(`Failed to fetch segments: ${segsRes.statusText}`);
      }

      const { segments } = await segsRes.json();
      console.log(`Fetched ${segments.length} segments`);

      // Fetch and parse events from all segments
      const events: WorldEvent[] = [];
      let cacheHits = 0;
      let cacheMisses = 0;
      for (const seg of segments) {
        const cachedSegment = segmentCacheRef.current[seg.hash];
        if (cachedSegment) {
          cacheHits += 1;
          events.push(...cachedSegment);
          continue;
        }

        cacheMisses += 1;
        const data = await fetch(`/object/${encodeURIComponent(seg.hash)}`).then((r) =>
          r.text()
        );

        const segmentEvents: WorldEvent[] = [];
        for (const line of data.trim().split('\n')) {
          if (line) {
            const parsed = JSON.parse(line);
            segmentEvents.push(parsed);
            events.push(parsed);
          }
        }

        segmentCacheRef.current[seg.hash] = segmentEvents;
      }
      console.log(`Segment cache hits: ${cacheHits}, misses: ${cacheMisses}`);

      console.log(`Loaded ${events.length} events`);

      // Build state from events
      const state = buildState(tile, baseSnapshot, events);
      console.log('Built state:', state);

      setSnapshot(baseSnapshot);
      setAllEvents(events);
      void writeCachedTile(space, tile, events, segmentCacheRef.current);
      if (events.length > 0) {
        const times = events.map((ev) => ev.timestamp);
        const min = Math.min(...times);
        const max = Math.max(...times);
        setTimelineRange({ min, max });
        setTimelinePct(1);
      } else {
        setTimelineRange(null);
        setTimelinePct(1);
      }
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
    const assets = getAssetForRole(symbolSet, semanticRole, assetPacks);

    // Create a create_node event
    const event: WorldEvent = {
      event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      space_id: spaceId,
      layer_id: 'layout' as const,
      actor_id: actorId,
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
      kind: 'semantic.symbol',
      transform: {
        position: [x, y, 0],
        rotation_quat: [0, 0, 0, 1],
        scale: [width, height, 1],
      },
      properties: {
        color: '#ffffff',
        label: semanticRole,
        semantic_role: semanticRole,
        narrative: {
          actions: ['spawn', 'highlight'],
          intensity: 0.6,
        },
      },
      ...(assets.svg
        ? { geometry: { kind: 'svg', ref: assets.svg, units: 'px' } }
        : {}),
      ...(assets.glb
        ? { geometry: { kind: 'glb', ref: assets.glb, units: 'm' } }
        : {}),
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

      setAllEvents((prev) => {
        const next = [...prev, event];
        if (timelineRange) {
          const min = Math.min(timelineRange.min, event.timestamp);
          const max = Math.max(timelineRange.max, event.timestamp);
          setTimelineRange({ min, max });
        } else {
          setTimelineRange({ min: event.timestamp, max: event.timestamp });
        }
        const isLive = timelinePct >= 0.999;
        if (isLive) {
          setTileState(buildState(tileState.tile_id, snapshot, next));
        }
        return next;
      });
      console.log('Created rectangle:', event.node_id);
    } catch (err: any) {
      console.error('Error creating rectangle:', err);
      alert(`Failed to create rectangle: ${err.message}`);
    }
  }

  function handleCursorMove(x: number, y: number) {
    const now = Date.now();
    if (now - lastPresenceSent.current < 50) return;
    lastPresenceSent.current = now;

    const payload: PresenceUpdate = {
      space_id: spaceId,
      actor_id: actorId,
      operation: 'cursor_update',
      position: [x, y, 0],
    };

    const ws = presenceSocket.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'presence', payload }));
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

  if (!tileState && !narrativeMode) {
    return null;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {viewMode === '2d' ? (
        <Canvas
          tileState={displayState ?? tileState}
          viewport={viewport}
          setViewport={setViewport}
          activeTool={activeTool}
          onCreateRectangle={createRectangle}
          presence={Object.values(presenceMap)}
          onCursorMove={handleCursorMove}
        />
      ) : null}
      {viewMode === '2d' ? (
        <Overlay2D
          tileState={displayState ?? tileState}
          viewport={viewport}
        />
      ) : null}
      {viewMode === '3d' ? (
        <Canvas3D tileState={displayState ?? tileState} />
      ) : null}
      {viewMode === 'voxel' ? (
        <VoxelCanvas tileState={displayState ?? tileState} />
      ) : null}
      {viewMode === '1d' ? (
        narrativeMode ? <NarrativeList beats={NARRATIVE_BEATS} activeId={narrative.beat.id} /> : <EventList events={filteredEvents} />
      ) : null}
      {narrativeMode && (narrative.beat.mode === 'prelude' || narrative.beat.mode === 'covenant') ? (
        <NarrativeCrawl beat={narrative.beat} progress={narrative.progress} />
      ) : null}
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        semanticRole={semanticRole}
        setSemanticRole={setSemanticRole}
        symbolSet={symbolSet}
        setSymbolSet={setSymbolSet}
        assetPacks={assetPacks.map((p) => ({ id: p.id, label: p.label }))}
        onImportPack={() => setIsImportingPack(true)}
      />
      {isImportingPack ? (
        <PackImportModal
          onClose={() => setIsImportingPack(false)}
          onImport={(pack) => {
            setAssetPacks((prev) => {
              const filtered = prev.filter((p) => p.id !== pack.id);
              return [...filtered, pack];
            });
            setSymbolSet(pack.id);
            setIsImportingPack(false);
          }}
        />
      ) : null}
      <StatusBar tileState={tileState} viewport={viewport} />
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid #333',
        }}
      >
        <button
          onClick={() => setViewMode('1d')}
          style={{
            padding: '8px 12px',
            background: viewMode === '1d' ? '#44cc88' : '#222',
            color: viewMode === '1d' ? '#fff' : '#aaa',
            border: '1px solid ' + (viewMode === '1d' ? '#44cc88' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          1D View
        </button>
        <button
          onClick={() => setNarrativeMode((prev) => !prev)}
          style={{
            padding: '8px 12px',
            background: narrativeMode ? '#5c6bc0' : '#222',
            color: narrativeMode ? '#fff' : '#aaa',
            border: '1px solid ' + (narrativeMode ? '#5c6bc0' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Narrative
        </button>
        <button
          onClick={() => setViewMode('2d')}
          style={{
            padding: '8px 12px',
            background: viewMode === '2d' ? '#44cc88' : '#222',
            color: viewMode === '2d' ? '#fff' : '#aaa',
            border: '1px solid ' + (viewMode === '2d' ? '#44cc88' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          2D View
        </button>
        <button
          onClick={() => setViewMode('voxel')}
          style={{
            padding: '8px 12px',
            background: viewMode === 'voxel' ? '#cc8844' : '#222',
            color: viewMode === 'voxel' ? '#fff' : '#aaa',
            border: '1px solid ' + (viewMode === 'voxel' ? '#cc8844' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Voxel
        </button>
        <button
          onClick={() => setViewMode('3d')}
          style={{
            padding: '8px 12px',
            background: viewMode === '3d' ? '#ff7744' : '#222',
            color: viewMode === '3d' ? '#fff' : '#aaa',
            border: '1px solid ' + (viewMode === '3d' ? '#ff7744' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          3D View
        </button>
      </div>
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
          gap: '6px',
          minWidth: '320px',
        }}
      >
        <div style={{ color: '#aaa', fontSize: '11px', fontFamily: 'monospace' }}>
          Timeline
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(timelinePct * 100)}
          disabled={!narrativeMode && (!timelineRange || allEvents.length === 0)}
          onChange={(e) => setTimelinePct(Number(e.target.value) / 100)}
        />
        <div style={{ color: '#666', fontSize: '10px', fontFamily: 'monospace' }}>
          {narrativeMode
            ? `${narrative.index + 1}/${NARRATIVE_BEATS.length} · ${narrative.beat.title}`
            : timelineRange
            ? new Date(
                timelineRange.min + (timelineRange.max - timelineRange.min) * timelinePct
              ).toLocaleTimeString()
            : 'No events'}
        </div>
      </div>
    </div>
  );
}

function PackImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (pack: AssetPack) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: '420px',
          background: '#111',
          border: '1px solid #333',
          borderRadius: '10px',
          padding: '16px',
          color: '#ddd',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        <div style={{ fontSize: '14px', marginBottom: '10px' }}>Import Asset Pack</div>
        <input
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const parsed = JSON.parse(String(reader.result));
                if (!parsed?.id || !parsed?.roleToAsset) {
                  alert('Invalid pack: missing id or roleToAsset');
                  return;
                }
                onImport(parsed as AssetPack);
              } catch {
                alert('Invalid JSON');
              }
            };
            reader.readAsText(file);
          }}
        />
        <div style={{ marginTop: '12px', color: '#888' }}>
          Expecting JSON with fields: id, label, roleToAsset.
        </div>
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 12px',
              background: '#222',
              color: '#ccc',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
