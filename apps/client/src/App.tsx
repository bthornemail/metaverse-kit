import { useEffect, useMemo, useRef, useState } from 'react';
import type { TileState } from '@metaverse-kit/shadow-canvas';
import { buildState, getLiveNodes } from '@metaverse-kit/shadow-canvas';
import type { WorldEvent, SpaceId, TileId, PresenceUpdate, Snapshot, NodeId, Transform } from '@metaverse-kit/protocol';
import Canvas from './components/Canvas';
import Canvas3D from './components/Canvas3D';
import Overlay2D from './components/Overlay2D';
import EventList from './components/EventList';
import NarrativeCrawl from './components/NarrativeCrawl';
import { NARRATIVE_BEATS } from './narrative/series';
import { narrativeFrame } from './narrative/engine';
import NarrativeList from './components/NarrativeList';
import { DEFAULT_ASSET_PACKS, type SemanticRole, getAssetForRole, type AssetPack, SEMANTIC_ROLES } from './semantic/roles';
import TimelineBar from './components/TimelineBar';
import StatusBar from './components/StatusBar';
import PalettePanel from './components/PalettePanel';
import LibraryPanel from './components/LibraryPanel';
import ImportsPanel from './components/ImportsPanel';
import MiniMap2D from './components/MiniMap2D';
import InspectorPanel from './components/InspectorPanel';
import { STENCIL_PACKS, findStencil } from './editor/stencils';
import { ext32Registry, loadExt32Packs, registerExt32Pack, resolveExt32InteractionList } from './ext32';
import type { Ext32InteractionAction, Ext32Trigger, Ext32Pack } from '@metaverse-kit/ext32';
import { importFiles, importFromUrl, listImportPacks } from './imports';
import { SAMPLE_ASSETS } from './sample-assets';

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

function normalizeSnapshot(raw: any): Snapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw.nodes)) return raw as Snapshot;
  if (raw.nodes && typeof raw.nodes === 'object') {
    const nodes = Array.isArray(raw.nodes) ? raw.nodes : Object.values(raw.nodes);
    if (Array.isArray(nodes)) {
      return { ...raw, nodes } as Snapshot;
    }
  }
  return null;
}

function readSnapshotFromStorage(space: SpaceId, tile: TileId): Snapshot | null {
  try {
    const raw = localStorage.getItem(snapshotStorageKey(space, tile));
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeSnapshot(parsed);
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
  const [activeTool, setActiveTool] = useState<'select' | 'rectangle' | 'connect' | 'pan'>('select');
  const [selectedIds, setSelectedIds] = useState<NodeId[]>([]);
  const [viewMode, setViewMode] = useState<'1d' | '2d' | 'wireframe' | '3d'>('wireframe');
  const [narrativeMode, setNarrativeMode] = useState(false);
  const [semanticRole, setSemanticRole] = useState<SemanticRole>('law');
  const [symbolSet, setSymbolSet] = useState(DEFAULT_ASSET_PACKS[0].id);
  const [assetPacks, setAssetPacks] = useState<AssetPack[]>(DEFAULT_ASSET_PACKS);
  const [activePackId, setActivePackId] = useState(STENCIL_PACKS[0].id);
  const [activeStencilId, setActiveStencilId] = useState<string | null>(STENCIL_PACKS[0].groups[0]?.stencils[0]?.id ?? null);
  const [activeRelation, setActiveRelation] = useState('relates');
  const [activeRoute, setActiveRoute] = useState<'orth' | 'straight' | 'bezier'>('orth');
  const [isImportingPack, setIsImportingPack] = useState(false);
  const [allEvents, setAllEvents] = useState<WorldEvent[]>([]);
  const [timelinePct, setTimelinePct] = useState(1);
  const [timelineRange, setTimelineRange] = useState<{ min: number; max: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<'fps' | 'eps'>('fps');
  const [fps, setFps] = useState(24);
  const [eps, setEps] = useState(2);
  const [markers, setMarkers] = useState<
    Array<{
      id: string;
      pct: number;
      label: string;
      type: 'cut' | 'keyframe' | 'beat' | 'loop-in' | 'loop-out';
      meaning?: { roles?: string[]; actions?: string[]; intensity?: number };
    }>
  >([]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [isToolboxOpen, setIsToolboxOpen] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceUpdate>>({});
  const [cameraPresets, setCameraPresets] = useState<
    Array<{
      id: string;
      label: string;
      viewMode: '1d' | '2d' | 'wireframe' | '3d';
      viewport?: ViewportState;
      camera3d?: { position: [number, number, number]; target: [number, number, number] };
    }>
  >([]);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [camera3dState, setCamera3dState] = useState<{ position: [number, number, number]; target: [number, number, number] } | null>(null);
  const historyRef = useRef<{
    undo: Array<{ forward: WorldEvent[]; inverse: WorldEvent[]; label: string; ts?: number }>;
    redo: Array<{ forward: WorldEvent[]; inverse: WorldEvent[]; label: string; ts?: number }>;
  }>({ undo: [], redo: [] });
  const [historyVersion, setHistoryVersion] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isExportOptionsOpen, setIsExportOptionsOpen] = useState(false);
  const [uiConfig, setUiConfig] = useState({ showPalette: true, showInspector: true, compact: false });
  const [isUiConfigOpen, setIsUiConfigOpen] = useState(false);
  const [isExt32Open, setIsExt32Open] = useState(false);
  const [ext32Version, setExt32Version] = useState(0);
  const [historyGroupWindowMs, setHistoryGroupWindowMs] = useState(1500);
  const [palettePinned, setPalettePinned] = useState(false);
  const [inspectorPinned, setInspectorPinned] = useState(false);
  const [leftPanelMode, setLeftPanelMode] = useState<'stencils' | 'library' | 'imports'>('stencils');
  const [libraryMode, setLibraryMode] = useState<'edit' | 'explore'>('edit');
  const [libraryCategory, setLibraryCategory] = useState<'all' | 'svg' | '3d' | 'media' | 'documents'>('all');
  const [importPacks, setImportPacks] = useState<Ext32Pack[]>([]);
  const [exportOptions, setExportOptions] = useState({
    durationMs: 5000,
    fps: 30,
    bounds: 'viewport' as 'viewport' | 'selection' | 'all',
    scale: 1,
    outputWidth: 0,
    outputHeight: 0,
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const presenceSocket = useRef<WebSocket | null>(null);
  const lastPresenceSent = useRef(0);
  const segmentCacheRef = useRef<Record<string, WorldEvent[]>>({});
  const lastTimelinePctRef = useRef<number | null>(null);
  const autoSampleRef = useRef(false);
  const ext32Packs = useMemo(() => ext32Registry.list(), [ext32Version]);
  const samplePacks = useMemo(
    () =>
      SAMPLE_ASSETS.map((sample) => ({
        pack_id: sample.pack_id,
        namespace: 'sample',
        version: '0.0.0',
        description: sample.label,
        features: [],
        assets: sample.assets as unknown as { default: Record<string, string> },
        projections: ['2d', '3d'],
        authority: 'proposal' as const,
        schema: (sample as { schema?: Record<string, unknown> }).schema ?? {},
      })),
    []
  );

  // Load tile from server
  useEffect(() => {
    loadTile(spaceId, tileId);
  }, [spaceId, tileId]);

  useEffect(() => {
    void loadExt32Packs().then(() => setExt32Version((v) => v + 1));
  }, []);

  useEffect(() => {
    void listImportPacks().then((packs) => {
      const merged = [...samplePacks, ...packs];
      merged.forEach((pack) => ext32Registry.register(pack));
      setImportPacks(merged);
    });
  }, []);

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

  const activeMeaning = useMemo(() => {
    const sorted = [...markers].sort((a, b) => a.pct - b.pct);
    let lastMeaning: typeof markers[number]["meaning"] | undefined;
    for (const marker of sorted) {
      if (marker.pct <= timelinePct && marker.meaning && marker.type !== 'cut') lastMeaning = marker.meaning;
    }
    return lastMeaning;
  }, [markers, timelinePct]);

  const narrative = useMemo(
    () => narrativeFrame(NARRATIVE_BEATS, timelinePct, activeMeaning),
    [timelinePct, activeMeaning]
  );
  const activeStencil = useMemo(
    () => (activeStencilId ? findStencil(activePackId, activeStencilId) : null),
    [activePackId, activeStencilId]
  );
  const displayState = narrativeMode ? narrative.state : tileState;
  const narrativeMarkers = useMemo(
    () =>
      NARRATIVE_BEATS.map((beat, idx) => ({
        id: `beat-${beat.id}`,
        pct: (idx + 1) / NARRATIVE_BEATS.length,
        label: beat.title,
        type: 'beat' as const,
      })),
    []
  );
  const activeMarkers = narrativeMode ? [...narrativeMarkers, ...markers] : markers;

  useEffect(() => {
    if (!isPlaying) return;
    if (!narrativeMode && (!timelineRange || allEvents.length === 0)) return;

    let last = performance.now();
    let acc = 0;
    let raf: number;

    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      acc += delta;

      const dataDurationMs = narrativeMode
        ? NARRATIVE_BEATS.length * 2500
        : Math.max(1, (timelineRange?.max ?? 1) - (timelineRange?.min ?? 0));
      const durationMs =
        playbackMode === 'eps' && !narrativeMode
          ? Math.max(1, (allEvents.length / eps) * 1000)
          : dataDurationMs;
      const frameInterval = 1000 / fps;

      if (acc >= frameInterval) {
        const next = timelinePct + (acc * playbackSpeed) / durationMs;
        acc = 0;
        if (next >= 1) {
          if (loopPlayback) {
            setTimelinePct(0);
          } else {
            setTimelinePct(1);
            setIsPlaying(false);
            return;
          }
        } else {
          setTimelinePct(next);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    isPlaying,
    playbackSpeed,
    loopPlayback,
    narrativeMode,
    timelineRange,
    allEvents.length,
    timelinePct,
    fps,
    eps,
    playbackMode,
  ]);

  useEffect(() => {
    if (!timelineRange || allEvents.length === 0) return;
    setTileState(buildState(tileId, snapshot, filteredEvents));
  }, [filteredEvents, tileId, timelineRange, snapshot, allEvents.length]);

  useEffect(() => {
    if (!tileState || !timelineRange) {
      lastTimelinePctRef.current = timelinePct;
      return;
    }
    const prevPct = lastTimelinePctRef.current;
    lastTimelinePctRef.current = timelinePct;
    if (prevPct === null || prevPct === timelinePct) return;
    const min = timelineRange.min;
    const max = timelineRange.max;
    const prevMs = min + (max - min) * prevPct;
    const nowMs = min + (max - min) * timelinePct;

    for (const node of tileState.nodes.values()) {
      if (!node.properties?.ext32_pack) continue;
      void handleExt32Trigger(node.node_id, 'timeline_enter', {
        timeline: { prevPct, nowPct: timelinePct, prevMs, nowMs, min, max },
      });
      void handleExt32Trigger(node.node_id, 'timeline_exit', {
        timeline: { prevPct, nowPct: timelinePct, prevMs, nowMs, min, max },
      });
    }
  }, [tileState, timelineRange, timelinePct]);

  useEffect(() => {
    if (allEvents.length === 0) return;
    void writeCachedTile(spaceId, tileId, allEvents, segmentCacheRef.current);
  }, [allEvents, spaceId, tileId]);

  useEffect(() => {
    if (!tileState) return;
    setSelectedIds((prev) => prev.filter((id) => tileState.nodes.has(id)));
  }, [tileState]);

  function exportProject() {
    const payload = {
      space_id: spaceId,
      tile_id: tileId,
      exported_at: Date.now(),
      snapshot,
      events: allEvents,
      markers,
      asset_packs: assetPacks,
      stencil_pack_id: activePackId,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mvk-${spaceId}-${tileId.replace(/\//g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportSvg() {
    const state = displayState ?? tileState;
    if (!state) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const nodes = getLiveNodes(state);
    const links: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; label: string; route: string }> = [];

    const nodeMap = new Map(nodes.map((n) => [n.node_id, n]));
    for (const node of nodes) {
      if (!node.links?.length) continue;
      for (const link of node.links) {
        const target = nodeMap.get(link.to);
        if (!target) continue;
        const [label, route = 'orth'] = String(link.relation).split('::');
        links.push({
          from: { x: node.transform.position[0], y: node.transform.position[1] },
          to: { x: target.transform.position[0], y: target.transform.position[1] },
          label,
          route,
        });
      }
    }

    function worldToScreen(x: number, y: number) {
      return [x * viewport.scale + viewport.offsetX, y * viewport.scale + viewport.offsetY];
    }

    const svgLinks = links
      .map((link) => {
        const [fx, fy] = worldToScreen(link.from.x, link.from.y);
        const [tx, ty] = worldToScreen(link.to.x, link.to.y);
        const midX = (fx + tx) / 2;
        let path = `M ${fx} ${fy}`;
        if (link.route === 'straight') {
          path += ` L ${tx} ${ty}`;
        } else if (link.route === 'bezier') {
          const cx = (fx + tx) / 2;
          path += ` Q ${cx} ${fy - 40} ${tx} ${ty}`;
        } else {
          path += ` L ${midX} ${fy} L ${tx} ${ty}`;
        }
        return `<path d="${path}" stroke="#666" stroke-width="1.2" fill="none" />` +
          (link.label ? `<text x="${midX + 4}" y="${fy - 4}" fill="#777" font-size="10" font-family="monospace">${escapeXml(link.label)}</text>` : '');
      })
      .join('');

    const svgNodes = nodes
      .map((node) => {
        const [sx, sy] = worldToScreen(node.transform.position[0], node.transform.position[1]);
        const w = node.transform.scale[0] * viewport.scale;
        const h = node.transform.scale[1] * viewport.scale;
        const shape = (node.properties?.stencil_shape as string) ?? 'rect';
        const label = (node.properties?.label as string) ?? '';
        if (shape === 'ellipse') {
          return `<ellipse cx="${sx + w / 2}" cy="${sy + h / 2}" rx="${w / 2}" ry="${h / 2}" stroke="#ccc" fill="none" />` +
            (label ? `<text x="${sx + 4}" y="${sy - 4}" fill="#888" font-size="12" font-family="monospace">${escapeXml(label)}</text>` : '');
        }
        if (shape === 'diamond') {
          const d = `M ${sx + w / 2} ${sy} L ${sx + w} ${sy + h / 2} L ${sx + w / 2} ${sy + h} L ${sx} ${sy + h / 2} Z`;
          return `<path d="${d}" stroke="#ccc" fill="none" />` +
            (label ? `<text x="${sx + 4}" y="${sy - 4}" fill="#888" font-size="12" font-family="monospace">${escapeXml(label)}</text>` : '');
        }
        return `<rect x="${sx}" y="${sy}" width="${w}" height="${h}" stroke="#ccc" fill="none" />` +
          (label ? `<text x="${sx + 4}" y="${sy - 4}" fill="#888" font-size="12" font-family="monospace">${escapeXml(label)}</text>` : '');
      })
      .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#0a0a0a" />
      ${svgLinks}
      ${svgNodes}
    </svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mvk-${spaceId}-${tileId.replace(/\//g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportPng() {
    const canvas = document.getElementById('mvk-canvas-2d') as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = cropCanvas(
      canvas,
      exportOptions.bounds,
      exportOptions.scale,
      exportOptions.outputWidth,
      exportOptions.outputHeight
    ).toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `mvk-${spaceId}-${tileId.replace(/\//g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function exportMp4() {
    const canvas = document.getElementById('mvk-canvas-2d') as HTMLCanvasElement | null;
    if (!canvas) return;
    const targetCanvas = cropCanvas(
      canvas,
      exportOptions.bounds,
      exportOptions.scale,
      exportOptions.outputWidth,
      exportOptions.outputHeight
    );
    const stream = targetCanvas.captureStream(exportOptions.fps);
    const preferredTypes = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopPromise = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start();
    const wasPlaying = isPlaying;
    setIsPlaying(true);
    const startPct = timelinePct;
    if (timelinePct >= 0.999) {
      setTimelinePct(0);
    }
    await new Promise((resolve) => setTimeout(resolve, exportOptions.durationMs));
    recorder.stop();
    await stopPromise;
    if (!wasPlaying) {
      setIsPlaying(false);
      setTimelinePct(startPct);
    }

    const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    link.download = `mvk-${spaceId}-${tileId.replace(/\//g, '_')}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (activeStencilId && findStencil(activePackId, activeStencilId)) return;
    const pack = STENCIL_PACKS.find((p) => p.id === activePackId);
    const first = pack?.groups[0]?.stencils[0]?.id ?? null;
    setActiveStencilId(first);
  }, [activePackId, activeStencilId]);

  function escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cropCanvas(
    source: HTMLCanvasElement,
    bounds: 'viewport' | 'selection' | 'all',
    scale = 1,
    outputWidth = 0,
    outputHeight = 0
  ) {
    if (bounds === 'viewport') {
      if (scale === 1 && outputWidth <= 0 && outputHeight <= 0) return source;
      const out = document.createElement('canvas');
      const targetW = outputWidth > 0 ? outputWidth : Math.max(1, Math.floor(source.width * scale));
      const targetH = outputHeight > 0 ? outputHeight : Math.max(1, Math.floor(source.height * scale));
      out.width = targetW;
      out.height = targetH;
      const outCtx = out.getContext('2d');
      if (!outCtx) return source;
      outCtx.drawImage(source, 0, 0, source.width, source.height, 0, 0, targetW, targetH);
      return out;
    }
    const ctx = source.getContext('2d');
    if (!ctx) return source;
    let x = 0;
    let y = 0;
    let w = source.width;
    let h = source.height;
    if (bounds === 'selection' && selectedIds.length && tileState) {
      const nodes = selectedIds
        .map((id) => tileState.nodes.get(id))
        .filter(Boolean);
      if (nodes.length) {
        const minX = Math.min(...nodes.map((n) => n!.transform.position[0]));
        const minY = Math.min(...nodes.map((n) => n!.transform.position[1]));
        const maxX = Math.max(...nodes.map((n) => n!.transform.position[0] + n!.transform.scale[0]));
        const maxY = Math.max(...nodes.map((n) => n!.transform.position[1] + n!.transform.scale[1]));
        const [sx, sy] = [minX * viewport.scale + viewport.offsetX, minY * viewport.scale + viewport.offsetY];
        const [sx2, sy2] = [maxX * viewport.scale + viewport.offsetX, maxY * viewport.scale + viewport.offsetY];
        x = Math.max(0, Math.floor(sx));
        y = Math.max(0, Math.floor(sy));
        w = Math.min(source.width - x, Math.ceil(sx2 - sx));
        h = Math.min(source.height - y, Math.ceil(sy2 - sy));
      }
    }
    if (bounds === 'all' && tileState) {
      const nodes = Array.from(tileState.nodes.values()).filter((n) => !n.deleted);
      if (nodes.length) {
        const minX = Math.min(...nodes.map((n) => n.transform.position[0]));
        const minY = Math.min(...nodes.map((n) => n.transform.position[1]));
        const maxX = Math.max(...nodes.map((n) => n.transform.position[0] + n.transform.scale[0]));
        const maxY = Math.max(...nodes.map((n) => n.transform.position[1] + n.transform.scale[1]));
        const [sx, sy] = [minX * viewport.scale + viewport.offsetX, minY * viewport.scale + viewport.offsetY];
        const [sx2, sy2] = [maxX * viewport.scale + viewport.offsetX, maxY * viewport.scale + viewport.offsetY];
        x = Math.max(0, Math.floor(sx));
        y = Math.max(0, Math.floor(sy));
        w = Math.min(source.width - x, Math.ceil(sx2 - sx));
        h = Math.min(source.height - y, Math.ceil(sy2 - sy));
      }
    }
    if (w <= 0 || h <= 0) return source;
    const out = document.createElement('canvas');
    const targetW = outputWidth > 0 ? outputWidth : Math.max(1, Math.floor(w * scale));
    const targetH = outputHeight > 0 ? outputHeight : Math.max(1, Math.floor(h * scale));
    out.width = targetW;
    out.height = targetH;
    const outCtx = out.getContext('2d');
    if (!outCtx) return source;
    outCtx.drawImage(source, x, y, w, h, 0, 0, targetW, targetH);
    return out;
  }

  const appendEvents = useMemo(() => async (events: WorldEvent[]) => {
    const res = await fetch('/append_events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        space_id: spaceId,
        tile_id: tileId,
        events,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to append event');
    }
  }, [spaceId, tileId]);

  useEffect(() => {
    if (!tileState || allEvents.length > 0) return;
    if (autoSampleRef.current) return;
    const key = `mvk:sample:phoenix:${spaceId}:${tileId}`;
    if (localStorage.getItem(key)) return;
    autoSampleRef.current = true;
    const event: WorldEvent = {
      ...makeEnvelope('create_node'),
      node_id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      kind: 'semantic.asset',
      transform: {
        position: [0, 0, 0],
        rotation_quat: [0, 0, 0, 1],
        scale: [120, 120, 120],
      },
      properties: {
        ext32_pack: 'sample.phoenix',
        ext32_features: [],
        semantic_role: 'phoenix',
        label: 'Phoenix',
      },
    };
    void appendEvents([event])
      .then(() => {
        setAllEvents((prev) => {
          const next = [...prev, event];
          if (timelineRange) {
            setTimelineRange({
              min: Math.min(timelineRange.min, event.timestamp),
              max: Math.max(timelineRange.max, event.timestamp),
            });
          } else {
            setTimelineRange({ min: event.timestamp, max: event.timestamp });
          }
          if (timelinePct >= 0.999) {
            setTileState(buildState(tileId, snapshot, next));
          }
          return next;
        });
        localStorage.setItem(key, '1');
      })
      .finally(() => {
        autoSampleRef.current = false;
      });
  }, [tileState, allEvents.length, spaceId, tileId, appendEvents, timelineRange, timelinePct, snapshot, tileId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          void redoLast();
        } else {
          void undoLast();
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length) {
          e.preventDefault();
          selectedIds.forEach((id) => void deleteNode(id));
        }
        return;
      }

      if (mod && e.key.toLowerCase() === 'd') {
        if (!selectedIds.length || !tileState) return;
        e.preventDefault();
        const copies: WorldEvent[] = [];
        for (const id of selectedIds) {
          const node = tileState.nodes.get(id);
          if (!node) continue;
          copies.push({
            ...makeEnvelope('create_node'),
            node_id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            kind: node.kind,
            transform: {
              ...node.transform,
              position: [node.transform.position[0] + 20, node.transform.position[1] + 20, node.transform.position[2]],
            },
            properties: { ...(node.properties ?? {}) },
          });
        }
        if (copies.length) {
          void appendEvents(copies).then(() => {
            setAllEvents((prev) => [...prev, ...copies]);
          });
        }
        return;
      }

      if (mod && e.key.toLowerCase() === 'g') {
        if (!selectedIds.length || !tileState) return;
        e.preventDefault();
        const groupSelected = selectedIds.length === 1 && tileState.nodes.get(selectedIds[0])?.kind === 'semantic.group';
        if (groupSelected) {
          void ungroupSelection();
          return;
        }
        void groupSelection();
      }

      if (selectedIds.length) {
        selectedIds.forEach((id) => {
          void handleExt32Trigger(id, 'key_down', { key: e.key });
        });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds, tileState, appendEvents, deleteNode, redoLast, undoLast, groupSelection, ungroupSelection]);

  useEffect(() => {
    function onKeyUp(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }
      if (!selectedIds.length) return;
      selectedIds.forEach((id) => {
        void handleExt32Trigger(id, 'key_up', { key: e.key });
      });
    }

    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, [selectedIds, tileState]);

  useEffect(() => {
    writeSnapshotToStorage(spaceId, tileId, snapshot);
  }, [snapshot, spaceId, tileId]);

  useEffect(() => {
    function onDocClick() {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [contextMenu.visible]);

  function pushHistory(label: string, forward: WorldEvent[], inverse: WorldEvent[]) {
    historyRef.current.undo.push({ forward, inverse, label, ts: Date.now() });
    historyRef.current.redo = [];
    setHistoryVersion((v) => v + 1);
  }

  function getNodeSnapshot(nodeId: NodeId) {
    const node = tileState?.nodes.get(nodeId);
    if (!node) return null;
    return {
      node_id: node.node_id,
      kind: node.kind,
      transform: node.transform,
      properties: { ...(node.properties ?? {}) },
    };
  }

  function makeEnvelope(operation: WorldEvent['operation']) {
    return {
      event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      space_id: spaceId,
      layer_id: 'layout' as const,
      actor_id: actorId,
      operation,
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
    };
  }

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
          baseSnapshot = normalizeSnapshot(await snapRes.json());
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

  async function createNodeFromStencil(x: number, y: number, width: number, height: number) {
    if (!tileState) return;
    const stencil = activeStencilId ? findStencil(activePackId, activeStencilId) : null;
    const role = stencil?.role ?? semanticRole;
    const assets = getAssetForRole(symbolSet, role, assetPacks);

    // Create a create_node event
    const event: WorldEvent = {
      ...makeEnvelope('create_node'),
      node_id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      kind: 'semantic.symbol',
      transform: {
        position: [x, y, 0],
        rotation_quat: [0, 0, 0, 1],
        scale: [width, height, 1],
      },
      properties: {
        color: '#ffffff',
        label: role,
        semantic_role: role,
        stencil_id: stencil?.id ?? null,
        stencil_shape: stencil?.shape ?? 'rect',
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
      await appendEvents([event]);
      const inverse: WorldEvent = {
        ...makeEnvelope('delete_node'),
        node_id: event.node_id,
      };
      pushHistory('create_node', [event], [inverse]);

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

  async function handleAssetDrop(
    payload: { mode?: string; packId?: string; assetType?: string; assetRef?: string; role?: string },
    world: { x: number; y: number },
    targetId?: NodeId
  ) {
    if (!tileState || !payload.packId) return;
    const packId = payload.packId;
    const role = payload.role;
    const events: WorldEvent[] = [];
    const now = Date.now();

    const setGeometryFor = (nodeId: NodeId, type?: string, ref?: string) => {
      if (!type || !ref) return;
      if (type === 'svg' || type === 'obj' || type === 'glb') {
        events.push({
          ...makeEnvelope('set_geometry'),
          node_id: nodeId,
          geometry: { kind: type, ref, units: type === 'svg' ? 'px' : 'm' },
        });
      } else if (type === 'mtl' || type === 'wav' || type === 'mp4') {
        events.push({
          ...makeEnvelope('set_media'),
          node_id: nodeId,
          media: { kind: type, ref },
        });
      }
    };

    const pack = ext32Registry.get(packId);
    const modelNodes = (pack?.schema as Record<string, unknown> | undefined)?.model_nodes;
    const modelNodeList = Array.isArray(modelNodes) ? (modelNodes as string[]) : null;

    if (targetId) {
      const targetNode = tileState.nodes.get(targetId);
      const currentPack = targetNode?.properties?.ext32_pack as string | undefined;
      const currentFeatures = Array.isArray(targetNode?.properties?.ext32_features)
        ? (targetNode?.properties?.ext32_features as string[])
        : [];
      const nextFeatures =
        packId === currentPack || currentFeatures.includes(packId)
          ? currentFeatures
          : [...currentFeatures, packId];
      const props: Record<string, unknown> = {
        ...(currentPack ? {} : { ext32_pack: packId }),
        ext32_features: nextFeatures,
      };
      if (role) {
        props.semantic_role = role;
      }
      if (modelNodeList) {
        props.model_nodes = modelNodeList;
      }
      events.push({
        ...makeEnvelope('set_properties'),
        node_id: targetId,
        properties: props,
      });
      if (payload.mode === 'asset') {
        setGeometryFor(targetId, payload.assetType, payload.assetRef);
      }
      if (!events.length) return;
      await appendEvents(events);
      setAllEvents((prev) => [...prev, ...events]);
      return;
    }

    const nodeId = `node-${now}-${Math.random().toString(36).substr(2, 9)}`;
    const createEvent: WorldEvent = {
      ...makeEnvelope('create_node'),
      node_id: nodeId,
      kind: 'semantic.asset',
      transform: {
        position: [world.x, world.y, 0],
        rotation_quat: [0, 0, 0, 1],
        scale: [120, 80, 1],
      },
      properties: {
        ext32_pack: packId,
        ext32_features: [],
        semantic_role: role ?? 'asset',
        ...(modelNodeList ? { model_nodes: modelNodeList } : {}),
      },
    };
    events.push(createEvent);
    if (payload.mode === 'asset') {
      setGeometryFor(nodeId, payload.assetType, payload.assetRef);
    }

    await appendEvents(events);
    const inverse: WorldEvent = {
      ...makeEnvelope('delete_node'),
      node_id: nodeId,
    };
    pushHistory('drop_asset', events, [inverse]);
    setAllEvents((prev) => {
      const next = [...prev, ...events];
      const min = timelineRange ? Math.min(timelineRange.min, createEvent.timestamp) : createEvent.timestamp;
      const max = timelineRange ? Math.max(timelineRange.max, createEvent.timestamp) : createEvent.timestamp;
      setTimelineRange({ min, max });
      if (timelinePct >= 0.999) {
        setTimelinePct(1);
      }
      return next;
    });
  }

  async function updateNodeTransform(nodeId: NodeId, transform: Transform) {
    const nodeSnapshot = getNodeSnapshot(nodeId);
    const event: WorldEvent = {
      ...makeEnvelope('update_transform'),
      node_id: nodeId,
      transform,
    };
    try {
      await appendEvents([event]);
      if (nodeSnapshot) {
        const inverse: WorldEvent = {
          ...makeEnvelope('update_transform'),
          node_id: nodeId,
          transform: nodeSnapshot.transform,
        };
        pushHistory('update_transform', [event], [inverse]);
      }
      setAllEvents((prev) => {
        const next = [...prev, event];
        if (timelinePct >= 0.999) {
          setTileState(buildState(tileId, snapshot, next));
        }
        return next;
      });
      setTimelineRange((prev) =>
        prev
          ? { min: Math.min(prev.min, event.timestamp), max: Math.max(prev.max, event.timestamp) }
          : { min: event.timestamp, max: event.timestamp }
      );
    } catch (err: any) {
      console.error('Error updating transform:', err);
    }
  }

  async function updateNodeTransforms(updates: Array<{ nodeId: NodeId; transform: Transform }>) {
    if (!updates.length) return;
    const events: WorldEvent[] = [];
    const inverseEvents: WorldEvent[] = [];
    for (const update of updates) {
      const nodeSnapshot = getNodeSnapshot(update.nodeId);
      events.push({
        ...makeEnvelope('update_transform'),
        node_id: update.nodeId,
        transform: update.transform,
      });
      if (nodeSnapshot) {
        inverseEvents.push({
          ...makeEnvelope('update_transform'),
          node_id: update.nodeId,
          transform: nodeSnapshot.transform,
        });
      }
    }
    try {
      await appendEvents(events);
      if (inverseEvents.length) {
        pushHistory('update_transforms', events, inverseEvents);
      }
      setAllEvents((prev) => {
        const next = [...prev, ...events];
        if (timelinePct >= 0.999) {
          setTileState(buildState(tileId, snapshot, next));
        }
        return next;
      });
      const lastTime = events[events.length - 1].timestamp;
      setTimelineRange((prev) =>
        prev
          ? { min: Math.min(prev.min, lastTime), max: Math.max(prev.max, lastTime) }
          : { min: lastTime, max: lastTime }
      );
    } catch (err: any) {
      console.error('Error updating transforms:', err);
    }
  }

  async function updateNodeProperties(nodeId: NodeId, properties: Record<string, unknown>, label = 'set_properties') {
    const nodeSnapshot = getNodeSnapshot(nodeId);
    const event: WorldEvent = {
      ...makeEnvelope('set_properties'),
      node_id: nodeId,
      properties,
    };
    try {
      await appendEvents([event]);
      if (nodeSnapshot) {
        const inverse: WorldEvent = {
          ...makeEnvelope('set_properties'),
          node_id: nodeId,
          properties: nodeSnapshot.properties,
        };
        if (label === 'feature_stack:move') {
          const last = historyRef.current.undo[historyRef.current.undo.length - 1];
          const now = Date.now();
          const lastEvent = last?.forward?.[0];
          if (
            last &&
            last.label === label &&
            lastEvent?.operation === 'set_properties' &&
            'node_id' in lastEvent &&
            lastEvent.node_id === nodeId &&
            now - (last.ts ?? 0) < historyGroupWindowMs
          ) {
            last.forward = [event];
            last.ts = now;
            historyRef.current.redo = [];
            setHistoryVersion((v) => v + 1);
          } else {
            pushHistory(label, [event], [inverse]);
          }
        } else {
          pushHistory(label, [event], [inverse]);
        }
      }
      setAllEvents((prev) => {
        const next = [...prev, event];
        if (timelinePct >= 0.999) {
          setTileState(buildState(tileId, snapshot, next));
        }
        return next;
      });
      setTimelineRange((prev) =>
        prev
          ? { min: Math.min(prev.min, event.timestamp), max: Math.max(prev.max, event.timestamp) }
          : { min: event.timestamp, max: event.timestamp }
      );
    } catch (err: any) {
      console.error('Error updating properties:', err);
    }
  }

  async function deleteNode(nodeId: NodeId) {
    const nodeSnapshot = getNodeSnapshot(nodeId);
    const event: WorldEvent = {
      ...makeEnvelope('delete_node'),
      node_id: nodeId,
    };
    try {
      await appendEvents([event]);
      if (nodeSnapshot) {
        const inverse: WorldEvent = {
          ...makeEnvelope('create_node'),
          node_id: nodeSnapshot.node_id,
          kind: nodeSnapshot.kind,
          transform: nodeSnapshot.transform,
          properties: nodeSnapshot.properties,
        };
        pushHistory('delete_node', [event], [inverse]);
      }
      setAllEvents((prev) => {
        const next = [...prev, event];
        if (timelinePct >= 0.999) {
          setTileState(buildState(tileId, snapshot, next));
        }
        return next;
      });
      setSelectedIds((prev) => prev.filter((id) => id !== nodeId));
      setTimelineRange((prev) =>
        prev
          ? { min: Math.min(prev.min, event.timestamp), max: Math.max(prev.max, event.timestamp) }
          : { min: event.timestamp, max: event.timestamp }
      );
    } catch (err: any) {
      console.error('Error deleting node:', err);
    }
  }

  async function linkNodes(from: NodeId, to: NodeId, relation: string) {
    const event: WorldEvent = {
      ...makeEnvelope('link_nodes'),
      from_node: from,
      to_node: to,
      relation,
    };
    try {
      await appendEvents([event]);
      const inverse: WorldEvent = {
        ...makeEnvelope('unlink_nodes'),
        from_node: from,
        to_node: to,
        relation,
      };
      pushHistory('link_nodes', [event], [inverse]);
      setAllEvents((prev) => {
        const next = [...prev, event];
        if (timelinePct >= 0.999) {
          setTileState(buildState(tileId, snapshot, next));
        }
        return next;
      });
      setTimelineRange((prev) =>
        prev
          ? { min: Math.min(prev.min, event.timestamp), max: Math.max(prev.max, event.timestamp) }
          : { min: event.timestamp, max: event.timestamp }
      );
    } catch (err: any) {
      console.error('Error linking nodes:', err);
    }
  }

  async function unlinkNodes(from: NodeId, to: NodeId, relation: string) {
    const event: WorldEvent = {
      ...makeEnvelope('unlink_nodes'),
      from_node: from,
      to_node: to,
      relation,
    };
    try {
      await appendEvents([event]);
      const inverse: WorldEvent = {
        ...makeEnvelope('link_nodes'),
        from_node: from,
        to_node: to,
        relation,
      };
      pushHistory('unlink_nodes', [event], [inverse]);
      setAllEvents((prev) => {
        const next = [...prev, event];
        if (timelinePct >= 0.999) {
          setTileState(buildState(tileId, snapshot, next));
        }
        return next;
      });
      setTimelineRange((prev) =>
        prev
          ? { min: Math.min(prev.min, event.timestamp), max: Math.max(prev.max, event.timestamp) }
          : { min: event.timestamp, max: event.timestamp }
      );
    } catch (err: any) {
      console.error('Error unlinking nodes:', err);
    }
  }

  async function undoLast() {
    const entry = historyRef.current.undo.pop();
    if (!entry) return;
    try {
      await appendEvents(entry.inverse);
      historyRef.current.redo.push(entry);
      setHistoryVersion((v) => v + 1);
      setAllEvents((prev) => {
        const next = [...prev, ...entry.inverse];
        if (timelinePct >= 0.999) {
          setTileState(buildState(tileId, snapshot, next));
        }
        return next;
      });
    } catch (err: any) {
      console.error('Undo failed:', err);
    }
  }

  async function redoLast() {
    const entry = historyRef.current.redo.pop();
    if (!entry) return;
    try {
      await appendEvents(entry.forward);
      historyRef.current.undo.push(entry);
      setHistoryVersion((v) => v + 1);
      setAllEvents((prev) => {
        const next = [...prev, ...entry.forward];
        if (timelinePct >= 0.999) {
          setTileState(buildState(tileId, snapshot, next));
        }
        return next;
      });
    } catch (err: any) {
      console.error('Redo failed:', err);
    }
  }

  async function undoMultiple(count: number) {
    for (let i = 0; i < count; i += 1) {
      // stop if stack empty
      if (historyRef.current.undo.length === 0) break;
      // eslint-disable-next-line no-await-in-loop
      await undoLast();
    }
  }

  async function redoMultiple(count: number) {
    for (let i = 0; i < count; i += 1) {
      if (historyRef.current.redo.length === 0) break;
      // eslint-disable-next-line no-await-in-loop
      await redoLast();
    }
  }

  async function groupSelection() {
    if (!selectedIds.length || !tileState) return;
    const nodes = selectedIds.map((id) => tileState.nodes.get(id)).filter(Boolean);
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map((n) => n!.transform.position[0]));
    const minY = Math.min(...nodes.map((n) => n!.transform.position[1]));
    const maxX = Math.max(...nodes.map((n) => n!.transform.position[0] + n!.transform.scale[0]));
    const maxY = Math.max(...nodes.map((n) => n!.transform.position[1] + n!.transform.scale[1]));
    const groupId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const groupEvent: WorldEvent = {
      ...makeEnvelope('create_node'),
      node_id: groupId,
      kind: 'semantic.group',
      transform: {
        position: [minX - 20, minY - 20, 0],
        rotation_quat: [0, 0, 0, 1],
        scale: [Math.max(40, maxX - minX + 40), Math.max(40, maxY - minY + 40), 1],
      },
      properties: {
        label: 'group',
        semantic_role: 'boundary',
        narrative: { actions: ['align'], intensity: 0.3 },
      },
    };
    const linkEvents = selectedIds.map((id) => ({
      ...makeEnvelope('link_nodes'),
      from_node: groupId,
      to_node: id,
      relation: 'groups::orth',
    }));
    const events = [groupEvent, ...linkEvents];
    await appendEvents(events);
    setAllEvents((prev) => [...prev, ...events]);
    setSelectedIds([groupId]);
  }

  async function ungroupSelection() {
    if (selectedIds.length !== 1 || !tileState) return;
    const groupId = selectedIds[0];
    const groupNode = tileState.nodes.get(groupId);
    if (!groupNode || groupNode.kind !== 'semantic.group') return;
    const unlinkEvents = (groupNode.links ?? []).map((link) => ({
      ...makeEnvelope('unlink_nodes'),
      from_node: groupId,
      to_node: link.to,
      relation: link.relation,
    }));
    const deleteEvent: WorldEvent = {
      ...makeEnvelope('delete_node'),
      node_id: groupId,
    };
    const events = [...unlinkEvents, deleteEvent];
    await appendEvents(events);
    setAllEvents((prev) => [...prev, ...events]);
    setSelectedIds([]);
  }

  function parseLiteral(raw: string): unknown {
    const trimmed = raw.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    const num = Number(trimmed);
    if (!Number.isNaN(num)) return num;
    return trimmed;
  }

  function pathSegments(path: string): string[] {
    return path.split('.').map((segment) => segment.trim()).filter(Boolean);
  }

  function getPathValue(obj: Record<string, unknown> | undefined, path: string): unknown {
    const segments = pathSegments(path);
    let current: unknown = obj;
    for (const segment of segments) {
      if (!current || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }

  function setPathValue(
    base: Record<string, unknown>,
    path: string,
    value: unknown
  ): { patch: Record<string, unknown>; topKey: string } {
    const segments = pathSegments(path);
    const topKey = segments[0] ?? path;
    const build = (current: unknown, idx: number): unknown => {
      if (idx >= segments.length) return value;
      const key = segments[idx];
      const currentObj = current && typeof current === 'object' ? (current as Record<string, unknown>) : {};
      return {
        ...currentObj,
        [key]: build(currentObj[key], idx + 1),
      };
    };
    const nextTop = build(base[topKey], 1);
    return { patch: { [topKey]: nextTop }, topKey };
  }

  function updatePathValue(
    base: Record<string, unknown>,
    path: string,
    updater: (value: unknown) => unknown
  ): { patch: Record<string, unknown>; topKey: string } {
    const current = getPathValue(base, path);
    return setPathValue(base, path, updater(current));
  }

  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function deepMerge(base: unknown, patch: unknown): unknown {
    if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
    const next: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      next[key] = deepMerge((base as Record<string, unknown>)[key], value);
    }
    return next;
  }

  function evalCondition(condition: string, props: Record<string, unknown>): boolean {
    const match = condition.match(/(.+?)(==|!=|>=|<=|>|<)(.+)/);
    if (!match) {
      return Boolean(getPathValue(props, condition.trim()));
    }
    const [, leftRaw, op, rightRaw] = match;
    const left = getPathValue(props, leftRaw.trim());
    const right = parseLiteral(rightRaw.trim());
    switch (op) {
      case '==':
        return left == right;
      case '!=':
        return left != right;
      case '>':
        return typeof left === 'number' && typeof right === 'number' ? left > right : false;
      case '<':
        return typeof left === 'number' && typeof right === 'number' ? left < right : false;
      case '>=':
        return typeof left === 'number' && typeof right === 'number' ? left >= right : false;
      case '<=':
        return typeof left === 'number' && typeof right === 'number' ? left <= right : false;
      default:
        return false;
    }
  }

  function resolveNodeRef(
    ref: 'self' | 'target' | string,
    selfId: NodeId,
    targetId?: NodeId
  ): NodeId | null {
    if (ref === 'self') return selfId;
    if (ref === 'target') return targetId ?? null;
    return ref;
  }

  function quatMultiply(
    a: [number, number, number, number],
    b: [number, number, number, number]
  ): [number, number, number, number] {
    const [ax, ay, az, aw] = a;
    const [bx, by, bz, bw] = b;
    return [
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz,
    ];
  }

  function quatFromEuler(yaw: number, pitch: number, roll: number): [number, number, number, number] {
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);
    return [
      sr * cp * cy - cr * sp * sy,
      cr * sp * cy + sr * cp * sy,
      cr * cp * sy - sr * sp * cy,
      cr * cp * cy + sr * sp * sy,
    ];
  }

  function makeMacroEvent(kind: string, payload: Record<string, unknown>): WorldEvent {
    return {
      ...makeEnvelope(`macro.${kind}` as WorldEvent['operation']),
      ...payload,
    } as WorldEvent;
  }

  function timelineValue(
    value: number,
    unit: 'pct' | 'ms' | undefined,
    timeline: { min: number; max: number }
  ) {
    if (unit === 'ms') return value;
    if (unit === 'pct' || value <= 1) return timeline.min + (timeline.max - timeline.min) * value;
    return value;
  }

  async function handleExt32Trigger(
    nodeId: NodeId,
    trigger: Ext32Trigger,
    context: {
      targetId?: NodeId;
      key?: string;
      delta?: { dx: number; dy: number; dz: number };
      timeline?: { prevPct: number; nowPct: number; prevMs: number; nowMs: number; min: number; max: number };
    } = {}
  ) {
    if (!tileState) return;
    const node = tileState.nodes.get(nodeId);
    if (!node) return;
    const packId = node.properties?.ext32_pack as string | undefined;
    if (!packId) return;
    const featureIds = Array.isArray(node.properties?.ext32_features)
      ? (node.properties?.ext32_features as string[])
      : [];
    const resolvedTargetId = context.targetId ?? selectedIds.find((id) => id !== nodeId);
    const interactions = resolveExt32InteractionList(packId, featureIds).filter((i) => i.trigger === trigger);
    if (!interactions.length) return;

    const workingProps: Record<string, unknown> = { ...(node.properties ?? {}) };
    let workingTransform = node.transform;
    const events: WorldEvent[] = [];

    for (const interaction of interactions) {
      if (interaction.key) {
        if (!context.key || interaction.key.toLowerCase() !== context.key.toLowerCase()) continue;
      }
      if (interaction.conditions && !interaction.conditions.every((cond) => evalCondition(cond, workingProps))) {
        continue;
      }
      if (trigger === 'timeline_enter' || trigger === 'timeline_exit') {
        if (!interaction.range || !context.timeline) continue;
        const { prevMs, nowMs, min, max } = context.timeline;
        const start = timelineValue(interaction.range.start, interaction.range.unit, { min, max });
        const end = timelineValue(interaction.range.end, interaction.range.unit, { min, max });
        const low = Math.min(start, end);
        const high = Math.max(start, end);
        const prevIn = prevMs >= low && prevMs <= high;
        const nowIn = nowMs >= low && nowMs <= high;
        if (trigger === 'timeline_enter' && (prevIn || !nowIn)) continue;
        if (trigger === 'timeline_exit' && (!prevIn || nowIn)) continue;
      }

      const runActions = (actions: Ext32InteractionAction[]) => {
        for (const action of actions) {
          if (action.operation === 'if') {
            const ok = evalCondition(action.condition, workingProps);
            runActions(ok ? action.then : action.else ?? []);
            continue;
          }

          if (action.operation === 'set_properties') {
            Object.assign(workingProps, action.properties);
            events.push({
              ...makeEnvelope('set_properties'),
              node_id: nodeId,
              properties: action.properties,
            });
            continue;
          }

          if (action.operation === 'merge_properties') {
            const patch: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(action.properties)) {
              patch[key] = deepMerge(workingProps[key], value);
            }
            Object.assign(workingProps, patch);
            events.push({
              ...makeEnvelope('set_properties'),
              node_id: nodeId,
              properties: patch,
            });
            continue;
          }

          if (action.operation === 'toggle_property') {
            const { patch, topKey } = updatePathValue(workingProps, action.path, (value) => !value);
            workingProps[topKey] = patch[topKey];
            events.push({
              ...makeEnvelope('set_properties'),
              node_id: nodeId,
              properties: patch,
            });
            continue;
          }

          if (action.operation === 'increment_property') {
            const { patch, topKey } = updatePathValue(workingProps, action.path, (value) =>
              typeof value === 'number' ? value + action.value : action.value
            );
            workingProps[topKey] = patch[topKey];
            events.push({
              ...makeEnvelope('set_properties'),
              node_id: nodeId,
              properties: patch,
            });
            continue;
          }

          if (action.operation === 'push_array') {
            const { patch, topKey } = updatePathValue(workingProps, action.path, (value) => {
              const next = Array.isArray(value) ? [...value] : [];
              next.push(action.value);
              return next;
            });
            workingProps[topKey] = patch[topKey];
            events.push({
              ...makeEnvelope('set_properties'),
              node_id: nodeId,
              properties: patch,
            });
            continue;
          }

          if (action.operation === 'remove_array_item') {
            const { patch, topKey } = updatePathValue(workingProps, action.path, (value) => {
              if (!Array.isArray(value)) return [];
              return value.filter((item) => item !== action.value);
            });
            workingProps[topKey] = patch[topKey];
            events.push({
              ...makeEnvelope('set_properties'),
              node_id: nodeId,
              properties: patch,
            });
            continue;
          }

          if (action.operation === 'set_geometry') {
            events.push({
              ...makeEnvelope('set_geometry'),
              node_id: nodeId,
              geometry: action.geometry,
            });
            continue;
          }

          if (action.operation === 'set_media') {
            events.push({
              ...makeEnvelope('set_media'),
              node_id: nodeId,
              media: action.media,
            });
            continue;
          }

          if (
            action.operation === 'set_transform' ||
            action.operation === 'translate' ||
            action.operation === 'rotate' ||
            action.operation === 'scale'
          ) {
            const [x, y, z] = workingTransform.position;
            const [sx, sy, sz] = workingTransform.scale;
            let next = { ...workingTransform };

            if (action.operation === 'set_transform') {
              next = {
                ...workingTransform,
                position: [
                  action.transform.x ?? x,
                  action.transform.y ?? y,
                  action.transform.z ?? z,
                ],
              };
            }

            if (action.operation === 'translate') {
              const dx = action.delta.dx ?? context.delta?.dx ?? 0;
              const dy = action.delta.dy ?? context.delta?.dy ?? 0;
              const dz = action.delta.dz ?? context.delta?.dz ?? 0;
              next = {
                ...workingTransform,
                position: [x + dx, y + dy, z + dz],
              };
            }

            if (action.operation === 'scale') {
              const sxv = action.scale.x ?? 1;
              const syv = action.scale.y ?? 1;
              const szv = action.scale.z ?? 1;
              next = {
                ...workingTransform,
                scale: [sx * sxv, sy * syv, sz * szv],
              };
            }

            if (action.operation === 'rotate') {
              const yaw = (action.rotation.yaw ?? 0) * (Math.PI / 180);
              const pitch = (action.rotation.pitch ?? 0) * (Math.PI / 180);
              const roll = (action.rotation.roll ?? 0) * (Math.PI / 180);
              const deltaQuat = quatFromEuler(yaw, pitch, roll);
              next = {
                ...workingTransform,
                rotation_quat: quatMultiply(workingTransform.rotation_quat, deltaQuat),
              };
            }

            workingTransform = next;
            events.push({
              ...makeEnvelope('update_transform'),
              node_id: nodeId,
              transform: next,
            });
            continue;
          }

          if (action.operation === 'create_node') {
            const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const props = { ...(action.node.properties ?? {}) };
            if (action.node.ext32_pack) {
              props.ext32_pack = action.node.ext32_pack;
            }
            events.push({
              ...makeEnvelope('create_node'),
              node_id: newId,
              kind: action.node.kind ?? 'semantic.node',
              transform: {
                position: [
                  workingTransform.position[0] + 40,
                  workingTransform.position[1] + 40,
                  workingTransform.position[2],
                ],
                rotation_quat: [0, 0, 0, 1],
                scale: [80, 60, 1],
              },
              properties: props,
            });
            continue;
          }

          if (action.operation === 'delete_node') {
            const target = resolveNodeRef(action.target, nodeId, resolvedTargetId);
            if (!target) continue;
            events.push({
              ...makeEnvelope('delete_node'),
              node_id: target,
            });
            continue;
          }

          if (action.operation === 'link_nodes') {
            const from = resolveNodeRef(action.link.from, nodeId, resolvedTargetId);
            const to = resolveNodeRef(action.link.to, nodeId, resolvedTargetId);
            if (!from || !to) continue;
            events.push({
              ...makeEnvelope('link_nodes'),
              from_node: from,
              to_node: to,
              relation: action.link.relation ?? 'relates',
            });
            continue;
          }

          if (action.operation === 'unlink_nodes') {
            const from = resolveNodeRef(action.link.from, nodeId, resolvedTargetId);
            const to = resolveNodeRef(action.link.to, nodeId, resolvedTargetId);
            if (!from || !to) continue;
            events.push({
              ...makeEnvelope('unlink_nodes'),
              from_node: from,
              to_node: to,
              relation: action.link.relation ?? 'relates',
            });
            continue;
          }

          if (action.operation === 'set_keyframe') {
            events.push(
              makeMacroEvent('keyframe', {
                node_id: nodeId,
                keyframe: action.keyframe,
              })
            );
            continue;
          }

          if (action.operation === 'play_animation') {
            events.push(
              makeMacroEvent('animation.play', {
                node_id: nodeId,
                name: action.name,
              })
            );
            continue;
          }

          if (action.operation === 'stop_animation') {
            events.push(
              makeMacroEvent('animation.stop', {
                node_id: nodeId,
                name: action.name,
              })
            );
            continue;
          }

          if (action.operation === 'scrub_timeline') {
            if (timelineRange) {
              const duration = Math.max(1, timelineRange.max - timelineRange.min);
              const pct = Math.min(1, Math.max(0, (action.time - timelineRange.min) / duration));
              setTimelinePct(pct);
            }
            events.push(
              makeMacroEvent('timeline.scrub', {
                node_id: nodeId,
                time: action.time,
              })
            );
            continue;
          }

          if (action.operation === 'play_media') {
            events.push(makeMacroEvent('media.play', { node_id: nodeId, ref: action.ref }));
            continue;
          }

          if (action.operation === 'pause_media') {
            events.push(makeMacroEvent('media.pause', { node_id: nodeId, ref: action.ref }));
            continue;
          }

          if (action.operation === 'stop_media') {
            events.push(makeMacroEvent('media.stop', { node_id: nodeId, ref: action.ref }));
            continue;
          }

          if (action.operation === 'set_volume') {
            events.push(makeMacroEvent('media.volume', { node_id: nodeId, ref: action.ref, volume: action.volume }));
            continue;
          }

          if (action.operation === 'emit_event') {
            events.push(makeMacroEvent('emit', { node_id: nodeId, event: action.event }));
          }
        }
      };

      runActions(interaction.actions);
    }

    if (!events.length) return;
    await appendEvents(events);
    setAllEvents((prev) => [...prev, ...events]);
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

  const uiPadding = uiConfig.compact ? '6px' : '10px';
  const uiButtonPadding = uiConfig.compact ? '6px 10px' : '8px 12px';
  const uiFontSize = uiConfig.compact ? '11px' : '12px';
  const uiLeft = uiConfig.showPalette ? '240px' : '20px';

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {viewMode === '2d' ? (
        <Canvas
          tileState={displayState ?? tileState}
          viewport={viewport}
          setViewport={setViewport}
          activeTool={activeTool}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onCreateNode={createNodeFromStencil}
          onUpdateTransform={updateNodeTransform}
          onUpdateTransforms={updateNodeTransforms}
          onCreateLink={(from, to) => linkNodes(from, to, `${activeRelation}::${activeRoute}`)}
          activeStencilShape={activeStencil?.shape ?? 'rect'}
          activeStencilDefaultSize={activeStencil?.defaultSize ?? { w: 120, h: 80 }}
          canvasId="mvk-canvas-2d"
          presence={Object.values(presenceMap)}
          onCursorMove={handleCursorMove}
          onContextMenu={(x, y) => {
            setContextMenu({ x, y, visible: true });
          }}
          onNodeClick={(nodeId) => {
            void handleExt32Trigger(nodeId, 'click');
          }}
          onNodeHoverStart={(nodeId) => {
            void handleExt32Trigger(nodeId, 'hover_start');
          }}
          onNodeHoverEnd={(nodeId) => {
            void handleExt32Trigger(nodeId, 'hover_end');
          }}
          onNodeDragStart={(nodeId, delta) => {
            void handleExt32Trigger(nodeId, 'drag_start', { delta });
          }}
          onNodeDragMove={(nodeId, delta) => {
            void handleExt32Trigger(nodeId, 'drag_move', { delta });
          }}
          onNodeDragEnd={(nodeId) => {
            void handleExt32Trigger(nodeId, 'drag_end');
          }}
          onAssetDrop={(payload, world, targetId) => {
            void handleAssetDrop(
              payload as { mode?: string; packId?: string; assetType?: string; assetRef?: string; role?: string },
              world,
              targetId
            );
          }}
        />
      ) : null}
      {viewMode === '2d' ? (
        <Overlay2D
          tileState={displayState ?? tileState}
          viewport={viewport}
        />
      ) : null}
      {viewMode === '3d' || viewMode === 'wireframe' ? (
        <Canvas3D
          tileState={displayState ?? tileState}
          cameraState={camera3dState ?? undefined}
          onCameraStateChange={(next) => setCamera3dState(next)}
          wireframe={viewMode === 'wireframe'}
        />
      ) : null}
      {viewMode === '1d' ? (
        narrativeMode ? <NarrativeList beats={NARRATIVE_BEATS} activeId={narrative.beat.id} /> : <EventList events={filteredEvents} />
      ) : null}
      {narrativeMode && (narrative.beat.mode === 'prelude' || narrative.beat.mode === 'covenant') ? (
        <NarrativeCrawl beat={narrative.beat} progress={narrative.progress} />
      ) : null}
      {viewMode === '2d' && uiConfig.showPalette ? (
        leftPanelMode === 'stencils' ? (
          <PalettePanel
            packs={STENCIL_PACKS}
            activePackId={activePackId}
            setActivePackId={setActivePackId}
            activeStencilId={activeStencilId}
            setActiveStencilId={setActiveStencilId}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            activeRelation={activeRelation}
            setActiveRelation={setActiveRelation}
            activeRoute={activeRoute}
            setActiveRoute={setActiveRoute}
            pinned={palettePinned}
            onTogglePin={() => setPalettePinned((v) => !v)}
          />
        ) : leftPanelMode === 'library' ? (
          <LibraryPanel
            packs={ext32Packs}
            mode="edit"
            category={libraryCategory}
            setCategory={setLibraryCategory}
          />
        ) : (
          <ImportsPanel
            packs={importPacks}
            onImportFiles={async (files) => {
              const packs = await importFiles(files);
              packs.forEach((pack) => ext32Registry.register(pack));
              setImportPacks((prev) => {
                const next = [...prev];
                for (const pack of packs) {
                  if (!next.find((p) => p.pack_id === pack.pack_id)) {
                    next.push(pack);
                  }
                }
                return next;
              });
            }}
            onImportUrl={async (url) => {
              const pack = await importFromUrl(url);
              if (!pack) return false;
              ext32Registry.register(pack);
              setImportPacks((prev) => (prev.find((p) => p.pack_id === pack.pack_id) ? prev : [...prev, pack]));
              return true;
            }}
          />
        )
      ) : null}
      {viewMode === '2d' && uiConfig.showInspector ? (
        <InspectorPanel
          tileState={tileState}
          selectedIds={selectedIds}
          onUpdateProperties={updateNodeProperties}
          onDeleteNode={deleteNode}
          onUpdateLink={async (from, to, relation, nextRelation, nextRoute) => {
            const nextValue = `${nextRelation || 'relates'}::${nextRoute}`;
            if (relation === nextValue) return;
            await unlinkNodes(from, to, relation);
            await linkNodes(from, to, nextValue);
          }}
          pinned={inspectorPinned}
          onTogglePin={() => setInspectorPinned((v) => !v)}
          historyGroupWindowMs={historyGroupWindowMs}
          importMeta={(() => {
            if (!selectedIds.length) return null;
            const node = tileState?.nodes.get(selectedIds[0]);
            const packId = node?.properties?.ext32_pack as string | undefined;
            if (!packId) return null;
            const pack = ext32Registry.get(packId);
            const meta = (pack?.schema as Record<string, unknown> | undefined)?.import_meta;
            return ({
              rid: pack?.pack_id,
              ...(meta ?? {}),
            } ?? null) as {
              rid?: string;
              filename?: string;
              size?: number;
              created_at?: number;
              source?: string;
              url?: string;
            } | null;
          })()}
        />
      ) : null}
      {isToolboxOpen ? (
        <ToolboxModal
          tileState={tileState}
          semanticRole={semanticRole}
          setSemanticRole={setSemanticRole}
          symbolSet={symbolSet}
          setSymbolSet={setSymbolSet}
          assetPacks={assetPacks}
          onImportPack={() => setIsImportingPack(true)}
          onClose={() => setIsToolboxOpen(false)}
        />
      ) : null}
      {isCameraModalOpen ? (
        <CameraModal
          viewport={viewport}
          viewMode={viewMode}
          presets={cameraPresets}
          onSave={(label) => {
            setCameraPresets((prev) => [
              ...prev,
              viewMode === '3d'
                ? {
                    id: `cam-${Date.now()}`,
                    label,
                    viewMode,
                    camera3d: camera3dState ?? { position: [0, 0, 200], target: [0, 0, 0] },
                  }
                : {
                    id: `cam-${Date.now()}`,
                    label,
                    viewMode,
                    viewport,
                  },
            ]);
          }}
          onApply={(preset) => {
            setViewMode(preset.viewMode);
            if (preset.viewport) {
              setViewport(preset.viewport);
            }
            if (preset.camera3d) {
              setCamera3dState(preset.camera3d);
            }
          }}
          onDelete={(id) => {
            setCameraPresets((prev) => prev.filter((p) => p.id !== id));
          }}
          onClose={() => setIsCameraModalOpen(false)}
        />
      ) : null}
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
          left: uiLeft,
          display: 'flex',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: uiPadding,
          borderRadius: '8px',
          border: '1px solid #333',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setViewMode('1d')}
          style={{
            padding: uiButtonPadding,
            background: viewMode === '1d' ? '#44cc88' : '#222',
            color: viewMode === '1d' ? '#fff' : '#aaa',
            border: '1px solid ' + (viewMode === '1d' ? '#44cc88' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          1D View
        </button>
        <button
          onClick={() => setNarrativeMode((prev) => !prev)}
          style={{
            padding: uiButtonPadding,
            background: narrativeMode ? '#5c6bc0' : '#222',
            color: narrativeMode ? '#fff' : '#aaa',
            border: '1px solid ' + (narrativeMode ? '#5c6bc0' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Narrative
        </button>
        <button
          onClick={() => setViewMode('2d')}
          style={{
            padding: uiButtonPadding,
            background: viewMode === '2d' ? '#44cc88' : '#222',
            color: viewMode === '2d' ? '#fff' : '#aaa',
            border: '1px solid ' + (viewMode === '2d' ? '#44cc88' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          2D View
        </button>
        <button
          onClick={() => setViewMode('wireframe')}
          style={{
            padding: uiButtonPadding,
            background: viewMode === 'wireframe' ? '#66ccff' : '#222',
            color: viewMode === 'wireframe' ? '#0b0b0b' : '#aaa',
            border: '1px solid ' + (viewMode === 'wireframe' ? '#66ccff' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Wireframe
        </button>
        <button
          onClick={() => setViewMode('3d')}
          style={{
            padding: uiButtonPadding,
            background: viewMode === '3d' ? '#ff7744' : '#222',
            color: viewMode === '3d' ? '#fff' : '#aaa',
            border: '1px solid ' + (viewMode === '3d' ? '#ff7744' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          3D View
        </button>
        <button
          onClick={() => setIsCameraModalOpen(true)}
          style={{
            padding: uiButtonPadding,
            background: '#222',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Cameras
        </button>
        <button
          onClick={() => setLeftPanelMode('stencils')}
          style={{
            padding: uiButtonPadding,
            background: leftPanelMode === 'stencils' ? '#4488ff' : '#222',
            color: leftPanelMode === 'stencils' ? '#fff' : '#aaa',
            border: '1px solid ' + (leftPanelMode === 'stencils' ? '#4488ff' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Stencils
        </button>
        <button
          onClick={() => {
            setLeftPanelMode('library');
            setLibraryMode('edit');
          }}
          style={{
            padding: uiButtonPadding,
            background: leftPanelMode === 'library' ? '#44aa88' : '#222',
            color: leftPanelMode === 'library' ? '#fff' : '#aaa',
            border: '1px solid ' + (leftPanelMode === 'library' ? '#44aa88' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Library
        </button>
        <button
          onClick={() => {
            setLeftPanelMode('imports');
            setLibraryMode('edit');
          }}
          style={{
            padding: uiButtonPadding,
            background: leftPanelMode === 'imports' ? '#55c2ff' : '#222',
            color: leftPanelMode === 'imports' ? '#fff' : '#aaa',
            border: '1px solid ' + (leftPanelMode === 'imports' ? '#55c2ff' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Imports
        </button>
        <button
          onClick={() => {
            setLeftPanelMode('library');
            setLibraryMode('explore');
          }}
          style={{
            padding: uiButtonPadding,
            background: libraryMode === 'explore' ? '#ff9f1a' : '#222',
            color: libraryMode === 'explore' ? '#111' : '#aaa',
            border: '1px solid ' + (libraryMode === 'explore' ? '#ff9f1a' : '#333'),
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Explore
        </button>
        <button
          onClick={() => void groupSelection()}
          style={{
            padding: uiButtonPadding,
            background: '#222',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Group
        </button>
        <button
          onClick={() => void ungroupSelection()}
          style={{
            padding: uiButtonPadding,
            background: '#222',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Ungroup
        </button>
        <button
          onClick={() => setIsToolboxOpen(true)}
          style={{
            padding: uiButtonPadding,
            background: '#222',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Toolbox
        </button>
        <button
          onClick={exportProject}
          style={{
            padding: uiButtonPadding,
            background: '#222',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          Export
        </button>
        {viewMode === '2d' ? (
          <button
            onClick={exportSvg}
            style={{
              padding: uiButtonPadding,
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: uiFontSize,
            }}
          >
            Export SVG
          </button>
        ) : null}
        {viewMode === '2d' ? (
          <button
            onClick={exportPng}
            style={{
              padding: uiButtonPadding,
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: uiFontSize,
            }}
          >
            Export PNG
          </button>
        ) : null}
        {viewMode === '2d' ? (
          <button
            onClick={() => exportMp4()}
            style={{
              padding: uiButtonPadding,
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: uiFontSize,
            }}
          >
            Export MP4
          </button>
        ) : null}
        {viewMode === '2d' ? (
          <button
            onClick={() => setIsExportOptionsOpen(true)}
            style={{
              padding: uiButtonPadding,
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: uiFontSize,
            }}
          >
            Export Options
          </button>
        ) : null}
        <button
          onClick={() => setIsUiConfigOpen(true)}
          style={{
            padding: uiButtonPadding,
            background: '#222',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          UI
        </button>
        <button
          onClick={() => setIsExt32Open(true)}
          style={{
            padding: uiButtonPadding,
            background: '#222',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: uiFontSize,
          }}
        >
          EXT32
        </button>
        <button
          onClick={() => setIsHistoryOpen(true)}
          style={{
            padding: '8px 12px',
            background: '#222',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          History
        </button>
      </div>
      <TimelineBar
        value={timelinePct}
        onChange={setTimelinePct}
        disabled={!narrativeMode && (!timelineRange || allEvents.length === 0)}
        label={
        narrativeMode
          ? `${narrative.index + 1}/${NARRATIVE_BEATS.length} · ${narrative.beat.title}`
          : timelineRange
          ? new Date(
              timelineRange.min + (timelineRange.max - timelineRange.min) * timelinePct
            ).toLocaleTimeString()
          : 'No events'
        }
        isPlaying={isPlaying}
        setPlaying={setIsPlaying}
        speed={playbackSpeed}
        setSpeed={setPlaybackSpeed}
        loop={loopPlayback}
        setLoop={setLoopPlayback}
        autoPlay={autoPlay}
        setAutoPlay={(value) => {
          setAutoPlay(value);
          if (value && !isPlaying) {
            if (timelinePct >= 0.999) {
              setTimelinePct(0);
            }
            setIsPlaying(true);
          }
        }}
        mode={playbackMode}
        setMode={setPlaybackMode}
        fps={fps}
        setFps={setFps}
        eps={eps}
        setEps={setEps}
        markers={activeMarkers}
        onAddMarker={() => {
          setMarkers((prev) => [
            ...prev,
            {
              id: `marker-${Date.now()}`,
              pct: timelinePct,
              label: `Cut ${prev.length + 1}`,
              type: 'cut',
            },
          ]);
        }}
        onSelectMarker={(id) => setSelectedMarkerId(id)}
        onMoveMarker={(id, pct) => {
          setMarkers((prev) =>
            prev.map((m) => (m.id === id ? { ...m, pct } : m))
          );
          setSelectedMarkerId(id);
        }}
      />
      {selectedMarkerId ? (
        <MarkerEditor
          marker={markers.find((m) => m.id === selectedMarkerId) ?? null}
          onClose={() => setSelectedMarkerId(null)}
          onSave={(next) => {
            setMarkers((prev) => prev.map((m) => (m.id === next.id ? next : m)));
            setSelectedMarkerId(null);
          }}
          onDelete={(id) => {
            setMarkers((prev) => prev.filter((m) => m.id !== id));
            setSelectedMarkerId(null);
          }}
        />
      ) : null}
      {isHistoryOpen ? (
        <HistoryModal
          onClose={() => setIsHistoryOpen(false)}
          entries={historyRef.current}
          version={historyVersion}
          onUndo={() => void undoLast()}
          onRedo={() => void redoLast()}
          onJumpUndo={(count) => void undoMultiple(count)}
          onJumpRedo={(count) => void redoMultiple(count)}
        />
      ) : null}
      {isExportOptionsOpen ? (
        <ExportOptionsModal
          options={exportOptions}
          onChange={(next) => setExportOptions(next)}
          onClose={() => setIsExportOptionsOpen(false)}
        />
      ) : null}
      {isUiConfigOpen ? (
        <UiConfigModal
          config={uiConfig}
          onChange={(next) => setUiConfig(next)}
          historyGroupWindowMs={historyGroupWindowMs}
          setHistoryGroupWindowMs={setHistoryGroupWindowMs}
          palettePinned={palettePinned}
          inspectorPinned={inspectorPinned}
          setPalettePinned={setPalettePinned}
          setInspectorPinned={setInspectorPinned}
          onClose={() => setIsUiConfigOpen(false)}
        />
      ) : null}
      {isExt32Open ? (
        <Ext32Modal
          version={ext32Version}
          onClose={() => setIsExt32Open(false)}
          onRefresh={async () => {
            await loadExt32Packs();
            setExt32Version((v) => v + 1);
          }}
        />
      ) : null}
      {libraryMode === 'explore' ? (
        <LibraryPanel
          packs={ext32Packs}
          mode="explore"
          category={libraryCategory}
          setCategory={setLibraryCategory}
          onClose={() => setLibraryMode('edit')}
        />
      ) : null}
      {contextMenu.visible ? (
        <div
          style={{
            position: 'absolute',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#111',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '6px',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <button
            onClick={() => {
              void groupSelection();
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{
              padding: '6px 10px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              textAlign: 'left',
            }}
          >
            Group
          </button>
          <button
            onClick={() => {
              void ungroupSelection();
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{
              padding: '6px 10px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              textAlign: 'left',
            }}
          >
            Ungroup
          </button>
        </div>
      ) : null}
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

function ToolboxModal({
  tileState,
  semanticRole,
  setSemanticRole,
  symbolSet,
  setSymbolSet,
  assetPacks,
  onImportPack,
  onClose,
}: {
  tileState: TileState | null;
  semanticRole: SemanticRole;
  setSemanticRole: (role: SemanticRole) => void;
  symbolSet: string;
  setSymbolSet: (id: string) => void;
  assetPacks: AssetPack[];
  onImportPack: () => void;
  onClose: () => void;
}) {
  const nodes = tileState ? Array.from(tileState.nodes.values()) : [];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 11,
      }}
    >
      <div
        style={{
          width: '520px',
          maxHeight: '80vh',
          overflow: 'auto',
          background: '#0f0f0f',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '18px',
          color: '#ddd',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        <div style={{ fontSize: '14px', marginBottom: '14px' }}>Toolbox</div>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ marginBottom: '6px', color: '#9aa' }}>Semantic Roles</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SEMANTIC_ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setSemanticRole(role)}
                style={{
                  padding: '6px 10px',
                  background: semanticRole === role ? '#4488ff' : '#222',
                  color: semanticRole === role ? '#fff' : '#aaa',
                  border: '1px solid ' + (semanticRole === role ? '#4488ff' : '#333'),
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ marginBottom: '6px', color: '#9aa' }}>Symbol Sets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {assetPacks.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setSymbolSet(pack.id)}
                style={{
                  padding: '6px 10px',
                  background: symbolSet === pack.id ? '#44cc88' : '#222',
                  color: symbolSet === pack.id ? '#fff' : '#aaa',
                  border: '1px solid ' + (symbolSet === pack.id ? '#44cc88' : '#333'),
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {pack.label}
              </button>
            ))}
            <button
              onClick={onImportPack}
              style={{
                padding: '6px 10px',
                background: '#222',
                color: '#aaa',
                border: '1px solid #333',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Import Pack
            </button>
          </div>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ marginBottom: '6px', color: '#9aa' }}>Shadow Context (Reuse)</div>
          <div style={{ color: '#777', marginBottom: '8px' }}>
            Pick a node as a semantic template. This does not edit geometry.
          </div>
          {nodes.length === 0 ? (
            <div style={{ color: '#555' }}>No nodes yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {nodes.slice(0, 8).map((node) => {
                const role = node.properties?.semantic_role ?? node.properties?.label ?? 'node';
                return (
                  <button
                    key={node.node_id}
                    onClick={() => setSemanticRole(String(role) as SemanticRole)}
                    style={{
                      padding: '6px 10px',
                      background: '#1a1a1a',
                      color: '#aaa',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {role} · {node.node_id}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

function CameraModal({
  viewport,
  viewMode,
  presets,
  onSave,
  onApply,
  onDelete,
  onClose,
}: {
  viewport: ViewportState;
  viewMode: '1d' | '2d' | 'wireframe' | '3d';
  presets: Array<{ id: string; label: string; viewMode: '1d' | '2d' | 'wireframe' | '3d'; viewport: ViewportState }>;
  onSave: (label: string) => void;
  onApply: (preset: { id: string; label: string; viewMode: '1d' | '2d' | 'wireframe' | '3d'; viewport: ViewportState }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 12,
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
        <div style={{ fontSize: '14px', marginBottom: '10px' }}>Camera Presets</div>
        <div style={{ color: '#777', marginBottom: '10px' }}>
          Current: {viewMode.toUpperCase()} · zoom {viewport.scale.toFixed(2)}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            id="camera-label"
            placeholder="Preset name"
            style={{
              flex: 1,
              padding: '6px 8px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          />
          <button
            onClick={() => {
              const label = (document.getElementById('camera-label') as HTMLInputElement)?.value?.trim();
              if (!label) return;
              onSave(label);
              (document.getElementById('camera-label') as HTMLInputElement).value = '';
            }}
            style={{
              padding: '8px 12px',
              background: '#44cc88',
              color: '#fff',
              border: '1px solid #44cc88',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
        <div style={{ maxHeight: '260px', overflow: 'auto', marginBottom: '12px' }}>
          {presets.length === 0 ? (
            <div style={{ color: '#555' }}>No presets yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    border: '1px solid #222',
                    borderRadius: '6px',
                    background: '#0b0b0b',
                  }}
                >
                  <div>
                    <div>{preset.label}</div>
                    <div style={{ color: '#666', fontSize: '11px' }}>
                      {preset.viewMode.toUpperCase()}
                      {preset.viewport ? ` · zoom ${preset.viewport.scale.toFixed(2)}` : ' · 3D'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => onApply(preset)}
                      style={{
                        padding: '6px 10px',
                        background: '#222',
                        color: '#aaa',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => onDelete(preset.id)}
                      style={{
                        padding: '6px 10px',
                        background: '#3a1f1f',
                        color: '#ffaaaa',
                        border: '1px solid #663333',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

function HistoryModal({
  entries,
  onClose,
  onUndo,
  onRedo,
  onJumpUndo,
  onJumpRedo,
  version,
}: {
  entries: { undo: Array<{ label: string; ts?: number }>; redo: Array<{ label: string; ts?: number }> };
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onJumpUndo: (count: number) => void;
  onJumpRedo: (count: number) => void;
  version: number;
}) {
  const undoList = entries.undo.slice().reverse();
  const redoList = entries.redo.slice().reverse();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 12,
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
        <div style={{ fontSize: '14px', marginBottom: '10px' }}>History</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={onUndo}
            style={{
              padding: '8px 12px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Undo
          </button>
          <button
            onClick={onRedo}
            style={{
              padding: '8px 12px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Redo
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#777', marginBottom: '6px' }}>Undo</div>
            <div style={{ maxHeight: '220px', overflow: 'auto' }}>
              {undoList.length === 0 ? (
                <div style={{ color: '#555' }}>Empty</div>
              ) : (
                undoList.map((entry, idx) => (
                  <button
                    key={`${entry.label}-${idx}`}
                    onClick={() => onJumpUndo(idx + 1)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '4px 6px',
                      background: '#111',
                      color: '#aaa',
                      border: '1px solid #222',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginBottom: '4px',
                    }}
                  >
                    {entry.label}
                  </button>
                ))
              )}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#777', marginBottom: '6px' }}>Redo</div>
            <div style={{ maxHeight: '220px', overflow: 'auto' }}>
              {redoList.length === 0 ? (
                <div style={{ color: '#555' }}>Empty</div>
              ) : (
                redoList.map((entry, idx) => (
                  <button
                    key={`${entry.label}-${idx}`}
                    onClick={() => onJumpRedo(idx + 1)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '4px 6px',
                      background: '#111',
                      color: '#aaa',
                      border: '1px solid #222',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginBottom: '4px',
                    }}
                  >
                    {entry.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <div style={{ marginTop: '12px', color: '#555' }}>Version: {version}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
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

function ExportOptionsModal({
  options,
  onChange,
  onClose,
}: {
  options: { durationMs: number; fps: number; bounds: 'viewport' | 'selection' | 'all'; scale: number; outputWidth: number; outputHeight: number };
  onChange: (next: { durationMs: number; fps: number; bounds: 'viewport' | 'selection' | 'all'; scale: number; outputWidth: number; outputHeight: number }) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 12,
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
        <div style={{ fontSize: '14px', marginBottom: '10px' }}>Export Options</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => onChange({ ...options, outputWidth: 1920, outputHeight: 1080, scale: 1 })}
            style={{
              padding: '6px 10px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            1080p
          </button>
          <button
            onClick={() => onChange({ ...options, outputWidth: 3840, outputHeight: 2160, scale: 1 })}
            style={{
              padding: '6px 10px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            4K
          </button>
          <button
            onClick={() => onChange({ ...options, fps: 60 })}
            style={{
              padding: '6px 10px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            60 FPS
          </button>
        </div>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Duration (ms)
          <input
            type="number"
            value={options.durationMs}
            onChange={(e) => onChange({ ...options, durationMs: Number(e.target.value) || 0 })}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          FPS
          <input
            type="number"
            value={options.fps}
            onChange={(e) => onChange({ ...options, fps: Number(e.target.value) || 1 })}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Bounds
          <select
            value={options.bounds}
            onChange={(e) =>
              onChange({ ...options, bounds: e.target.value as 'viewport' | 'selection' | 'all' })
            }
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          >
            <option value="viewport">Viewport</option>
            <option value="selection">Selection</option>
            <option value="all">All Nodes</option>
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Output Width
          <input
            type="number"
            value={options.outputWidth}
            onChange={(e) => onChange({ ...options, outputWidth: Number(e.target.value) || 0 })}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Output Height
          <input
            type="number"
            value={options.outputHeight}
            onChange={(e) => onChange({ ...options, outputHeight: Number(e.target.value) || 0 })}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Scale
          <input
            type="number"
            value={options.scale}
            onChange={(e) => onChange({ ...options, scale: Number(e.target.value) || 1 })}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

function UiConfigModal({
  config,
  onChange,
  historyGroupWindowMs,
  setHistoryGroupWindowMs,
  palettePinned,
  inspectorPinned,
  setPalettePinned,
  setInspectorPinned,
  onClose,
}: {
  config: { showPalette: boolean; showInspector: boolean; compact: boolean };
  onChange: (next: { showPalette: boolean; showInspector: boolean; compact: boolean }) => void;
  historyGroupWindowMs: number;
  setHistoryGroupWindowMs: (value: number) => void;
  palettePinned: boolean;
  inspectorPinned: boolean;
  setPalettePinned: (value: boolean) => void;
  setInspectorPinned: (value: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 12,
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
        <div style={{ fontSize: '14px', marginBottom: '10px' }}>UI Settings</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => onChange({ showPalette: true, showInspector: true, compact: false })}
            style={{
              padding: '6px 10px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Docked
          </button>
          <button
            onClick={() => onChange({ showPalette: false, showInspector: false, compact: true })}
            style={{
              padding: '6px 10px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Minimal
          </button>
          <button
            onClick={() => onChange({ showPalette: false, showInspector: false, compact: false })}
            style={{
              padding: '6px 10px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Presentation
          </button>
        </div>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={config.showPalette}
            onChange={(e) => onChange({ ...config, showPalette: e.target.checked })}
            style={{ marginRight: '8px' }}
          />
          Show Palette
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={config.showInspector}
            onChange={(e) => onChange({ ...config, showInspector: e.target.checked })}
            style={{ marginRight: '8px' }}
          />
          Show Inspector
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={config.compact}
            onChange={(e) => onChange({ ...config, compact: e.target.checked })}
            style={{ marginRight: '8px' }}
          />
          Compact Mode
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={palettePinned && inspectorPinned}
            onChange={(e) => {
              setPalettePinned(e.target.checked);
              setInspectorPinned(e.target.checked);
            }}
            style={{ marginRight: '8px' }}
          />
          Pin Both Side Panels
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={palettePinned}
            onChange={(e) => setPalettePinned(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          Pin Palette
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={inspectorPinned}
            onChange={(e) => setInspectorPinned(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          Pin Inspector
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          History group window (ms)
          <input
            type="number"
            min={100}
            step={100}
            value={historyGroupWindowMs}
            onChange={(e) => setHistoryGroupWindowMs(Number(e.target.value))}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

function Ext32Modal({
  version,
  onClose,
  onRefresh,
}: {
  version: number;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const packs = ext32Registry.list();
  void version;
  const [status, setStatus] = useState<string | null>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    await registerExt32Pack(parsed);
    await onRefresh();
    setStatus(`Registered ${parsed.pack_id ?? "pack"}`);
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 12,
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
        <div style={{ fontSize: '14px', marginBottom: '10px' }}>EXT32 Packs</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={onRefresh}
            style={{
              padding: '6px 10px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
          <label
            style={{
              padding: '6px 10px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Upload JSON
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void handleFile(file).catch((err) => setStatus(String(err.message ?? err)));
              }}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            void handleFile(file).catch((err) => setStatus(String(err.message ?? err)));
          }}
          style={{
            border: '1px dashed #333',
            borderRadius: '8px',
            padding: '12px',
            color: '#666',
            marginBottom: '12px',
          }}
        >
          Drag & drop EXT32 pack JSON here
        </div>
        {status ? (
          <div style={{ color: '#777', marginBottom: '12px' }}>{status}</div>
        ) : null}
        <div style={{ maxHeight: '260px', overflow: 'auto' }}>
          {packs.length === 0 ? (
            <div style={{ color: '#555' }}>No packs registered.</div>
          ) : (
            packs.map((pack) => (
              <div
                key={pack.pack_id}
                style={{
                  padding: '8px',
                  border: '1px solid #222',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  background: '#0b0b0b',
                }}
              >
                <div>{pack.pack_id}</div>
                <div style={{ color: '#666' }}>{pack.namespace} · {pack.version}</div>
                {pack.description ? (
                  <div style={{ color: '#777', marginTop: '6px' }}>{pack.description}</div>
                ) : null}
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
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

function MarkerEditor({
  marker,
  onClose,
  onSave,
  onDelete,
}: {
  marker: {
    id: string;
    pct: number;
    label: string;
    type: 'cut' | 'keyframe' | 'beat' | 'loop-in' | 'loop-out';
    meaning?: { roles?: string[]; actions?: string[]; intensity?: number };
  } | null;
  onClose: () => void;
  onSave: (marker: {
    id: string;
    pct: number;
    label: string;
    type: 'cut' | 'keyframe' | 'beat' | 'loop-in' | 'loop-out';
    meaning?: { roles?: string[]; actions?: string[]; intensity?: number };
  }) => void;
  onDelete: (id: string) => void;
}) {
  if (!marker) return null;
  const roles = marker.meaning?.roles?.join(',') ?? '';
  const actions = marker.meaning?.actions?.join(',') ?? '';
  const intensity = marker.meaning?.intensity ?? 0.6;
  const type = marker.type;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 12,
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
        <div style={{ fontSize: '14px', marginBottom: '12px' }}>Marker Meaning</div>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Label
          <input
            defaultValue={marker.label}
            id="marker-label"
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Type
          <select
            defaultValue={type}
            id="marker-type"
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          >
            <option value="cut">Cut</option>
            <option value="keyframe">Keyframe</option>
            <option value="beat">Beat</option>
            <option value="loop-in">Loop In</option>
            <option value="loop-out">Loop Out</option>
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Roles (comma-separated)
          <input
            defaultValue={roles}
            id="marker-roles"
            placeholder={SEMANTIC_ROLES.join(',')}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Actions (comma-separated)
          <input
            defaultValue={actions}
            id="marker-actions"
            placeholder="spawn,highlight,align,fade"
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              background: '#090909',
              color: '#ddd',
              border: '1px solid #333',
              borderRadius: '6px',
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '16px' }}>
          Intensity
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={intensity}
            id="marker-intensity"
            style={{ width: '100%', marginTop: '6px' }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => {
              const label = (document.getElementById('marker-label') as HTMLInputElement)?.value ?? marker.label;
              const typeValue = (document.getElementById('marker-type') as HTMLSelectElement)?.value ?? marker.type;
              const rolesValue = (document.getElementById('marker-roles') as HTMLInputElement)?.value ?? '';
              const actionsValue = (document.getElementById('marker-actions') as HTMLInputElement)?.value ?? '';
              const intensityValue = Number((document.getElementById('marker-intensity') as HTMLInputElement)?.value ?? intensity);
              const parsedRoles = rolesValue
                .split(',')
                .map((r) => r.trim())
                .filter(Boolean);
              const parsedActions = actionsValue
                .split(',')
                .map((a) => a.trim())
                .filter(Boolean);

              onSave({
                ...marker,
                label,
                type: typeValue as 'cut' | 'keyframe' | 'beat' | 'loop-in' | 'loop-out',
                meaning: {
                  roles: parsedRoles.length ? parsedRoles : undefined,
                  actions: parsedActions.length ? parsedActions : undefined,
                  intensity: intensityValue,
                },
              });
            }}
            style={{
              padding: '8px 12px',
              background: '#44cc88',
              color: '#fff',
              border: '1px solid #44cc88',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          <button
            onClick={() => onDelete(marker.id)}
            style={{
              padding: '8px 12px',
              background: '#3a1f1f',
              color: '#ffaaaa',
              border: '1px solid #663333',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 12px',
              background: '#222',
              color: '#aaa',
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
