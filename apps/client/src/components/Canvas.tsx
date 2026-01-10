import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { TileState } from '@metaverse-kit/shadow-canvas';
import { getLiveNodes } from '@metaverse-kit/shadow-canvas';
import type { PresenceUpdate } from '@metaverse-kit/protocol';
import { computeRenderState, hasIsolate } from '../rendering/narrative';

interface CanvasProps {
  tileState: TileState;
  viewport: { offsetX: number; offsetY: number; scale: number };
  setViewport: (v: any) => void;
  activeTool: 'select' | 'rectangle';
  onCreateRectangle: (x: number, y: number, width: number, height: number) => void;
  presence: PresenceUpdate[];
  onCursorMove: (x: number, y: number) => void;
}

export default function Canvas({
  tileState,
  viewport,
  setViewport,
  activeTool,
  onCreateRectangle,
  presence,
  onCursorMove,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawEnd, setDrawEnd] = useState({ x: 0, y: 0 });
  const svgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioCacheRef = useRef<Map<string, Float32Array>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [svgTick, setSvgTick] = useState(0);
  const [videoTick, setVideoTick] = useState(0);

  // Render canvas on every update
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, viewport);

    // Render nodes
    const liveNodes = getLiveNodes(tileState);
    const isolateActive = hasIsolate(liveNodes);
    for (const node of liveNodes) {
      const renderState = computeRenderState(node, isolateActive);
      const [x, y] = node.transform.position;
      const [w, h] = node.transform.scale;
      const worldX = x + renderState.offset[0];
      const worldY = y + renderState.offset[1];

      const [sx, sy] = worldToScreen(worldX, worldY, viewport);
      const sw = w * viewport.scale * renderState.scale;
      const sh = h * viewport.scale * renderState.scale;

      // Draw rectangle
      ctx.globalAlpha = renderState.opacity;
      ctx.strokeStyle = relationStroke(renderState.relation) || (node.properties.color as string) || '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, sh);

      if (renderState.highlight) {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - 2, sy - 2, sw + 4, sh + 4);
      }

      // Draw SVG projection if available
      const svgRef = node.geometry?.kind === 'svg' ? node.geometry.ref : node.media?.kind === 'svg' ? node.media.ref : null;
      if (svgRef) {
        const url = resolveRef(svgRef);
        const cached = svgCacheRef.current.get(url);
        if (cached && cached.complete) {
          ctx.drawImage(cached, sx, sy, sw, sh);
        } else if (!cached) {
          const img = new Image();
          img.onload = () => setSvgTick((t) => t + 1);
          img.src = url;
          svgCacheRef.current.set(url, img);
        }
      }

      if (node.media?.kind === 'mp4') {
        const url = resolveRef(node.media.ref);
        let video = videoCacheRef.current.get(url);
        if (!video) {
          video = document.createElement('video');
          video.src = url;
          video.crossOrigin = 'anonymous';
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          void video.play();
          videoCacheRef.current.set(url, video);
        }
        if (video.readyState >= 2) {
          ctx.drawImage(video, sx, sy, sw, sh);
        }
      }

      if (node.media?.kind === 'wav') {
        const url = resolveRef(node.media.ref);
        const samples = audioCacheRef.current.get(url);
        if (samples) {
          drawWaveform(ctx, samples, sx, sy, sw, sh);
        } else {
          void loadAudioSamples(url, audioCacheRef, audioCtxRef, () => setSvgTick((t) => t + 1));
        }
      }

      // Draw media/geometry/text/document badges
      const badges: string[] = [];
      if (node.geometry?.kind) badges.push(`geom:${node.geometry.kind}`);
      if (node.media?.kind) badges.push(`media:${node.media.kind}`);
      if (node.text?.kind) badges.push(`text:${node.text.kind}`);
      if (node.document?.kind) badges.push(`doc:${node.document.kind}`);

      if (badges.length > 0) {
        ctx.fillStyle = '#222';
        ctx.fillRect(sx, sy + sh + 4, Math.min(180, badges.join(' ').length * 6 + 10), 16);
        ctx.fillStyle = '#aaa';
        ctx.font = '10px monospace';
        ctx.fillText(badges.join(' '), sx + 4, sy + sh + 16);
      }

      // Draw label
      if (node.properties.label) {
        ctx.fillStyle = '#888';
        ctx.font = '12px monospace';
        ctx.fillText(node.properties.label as string, sx + 4, sy - 4);
      }
      ctx.globalAlpha = 1;
    }

    // Draw preview rectangle while drawing
    if (isDrawing && activeTool === 'rectangle') {
      const [sx1, sy1] = worldToScreen(drawStart.x, drawStart.y, viewport);
      const [sx2, sy2] = worldToScreen(drawEnd.x, drawEnd.y, viewport);
      const sw = sx2 - sx1;
      const sh = sy2 - sy1;

      ctx.strokeStyle = '#4488ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(sx1, sy1, sw, sh);
      ctx.setLineDash([]);
    }

    // Draw presence cursors
    for (const p of presence) {
      if (p.operation !== 'cursor_update' || !p.position) continue;
      const [x, y] = p.position;
      const [sx, sy] = worldToScreen(x, y, viewport);
      const color = colorFromActor(p.actor_id);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ccc';
      ctx.font = '11px monospace';
      ctx.fillText(p.actor_id, sx + 8, sy - 8);
    }
  }, [tileState, viewport, isDrawing, drawStart, drawEnd, activeTool, presence, svgTick, videoTick]);

  useEffect(() => {
    const hasVideo = getLiveNodes(tileState).some((node) => node.media?.kind === 'mp4');
    if (!hasVideo) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const tick = () => {
      setVideoTick((t) => (t + 1) % 100000);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [tileState]);

  function drawGrid(ctx: CanvasRenderingContext2D, vp: any) {
    const gridSize = 50;
    const scaledGridSize = gridSize * vp.scale;

    // Only draw grid if it's visible
    if (scaledGridSize < 5) return;

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;

    // Vertical lines
    const startX = Math.floor((-vp.offsetX / scaledGridSize)) * scaledGridSize;
    for (let x = startX; x < window.innerWidth; x += scaledGridSize) {
      const screenX = x + (vp.offsetX % scaledGridSize);
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, window.innerHeight);
      ctx.stroke();
    }

    // Horizontal lines
    const startY = Math.floor((-vp.offsetY / scaledGridSize)) * scaledGridSize;
    for (let y = startY; y < window.innerHeight; y += scaledGridSize) {
      const screenY = y + (vp.offsetY % scaledGridSize);
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(window.innerWidth, screenY);
      ctx.stroke();
    }

    // Draw origin
    const [ox, oy] = worldToScreen(0, 0, vp);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox - 10, oy);
    ctx.lineTo(ox + 10, oy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox, oy - 10);
    ctx.lineTo(ox, oy + 10);
    ctx.stroke();
  }

  function worldToScreen(x: number, y: number, vp: any): [number, number] {
    return [x * vp.scale + vp.offsetX, y * vp.scale + vp.offsetY];
  }

  function screenToWorld(sx: number, sy: number, vp: any): [number, number] {
    return [(sx - vp.offsetX) / vp.scale, (sy - vp.offsetY) / vp.scale];
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();

    // Zoom centered on mouse position
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const [worldX, worldY] = screenToWorld(mouseX, mouseY, viewport);

    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.max(0.1, Math.min(10, viewport.scale * zoomFactor));

    // Adjust offset to keep mouse position fixed
    const newOffsetX = mouseX - worldX * newScale;
    const newOffsetY = mouseY - worldY * newScale;

    setViewport({
      offsetX: newOffsetX,
      offsetY: newOffsetY,
      scale: newScale,
    });
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    (e.target as Element).setPointerCapture(e.pointerId);

    if (activeTool === 'select') {
      // Pan mode
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeTool === 'rectangle') {
      // Draw mode
      setIsDrawing(true);
      const [wx, wy] = screenToWorld(e.clientX, e.clientY, viewport);
      setDrawStart({ x: wx, y: wy });
      setDrawEnd({ x: wx, y: wy });
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (activePointerId.current !== e.pointerId) return;
    if (isDragging && activeTool === 'select') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      setViewport({
        ...viewport,
        offsetX: viewport.offsetX + dx,
        offsetY: viewport.offsetY + dy,
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (isDrawing && activeTool === 'rectangle') {
      const [wx, wy] = screenToWorld(e.clientX, e.clientY, viewport);
      setDrawEnd({ x: wx, y: wy });
    }

    const [wx, wy] = screenToWorld(e.clientX, e.clientY, viewport);
    onCursorMove(wx, wy);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (activePointerId.current !== e.pointerId) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    activePointerId.current = null;

    if (isDragging) {
      setIsDragging(false);
    } else if (isDrawing && activeTool === 'rectangle') {
      setIsDrawing(false);

      // Create rectangle
      const x = Math.min(drawStart.x, drawEnd.x);
      const y = Math.min(drawStart.y, drawEnd.y);
      const width = Math.abs(drawEnd.x - drawStart.x);
      const height = Math.abs(drawEnd.y - drawStart.y);

      // Only create if rectangle has meaningful size
      if (width > 1 && height > 1) {
        onCreateRectangle(x, y, width, height);
      }
    }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        cursor: activeTool === 'select' ? (isDragging ? 'grabbing' : 'grab') : 'crosshair',
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseLeave={() => {
        setIsDragging(false);
        setIsDrawing(false);
        activePointerId.current = null;
      }}
    />
  );
}

function resolveRef(ref: string): string {
  if (ref.startsWith('symbol:')) {
    return symbolSvgData(ref);
  }
  if (ref.startsWith('sha256:') || ref.startsWith('blake3:')) {
    return `/object/${encodeURIComponent(ref)}`;
  }
  return ref;
}

function symbolSvgData(ref: string): string {
  const name = ref.replace('symbol:', '');
  const label = name.toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
    <rect width="128" height="128" fill="none" stroke="#88a0ff" stroke-width="4"/>
    <text x="64" y="70" text-anchor="middle" font-size="18" fill="#88a0ff" font-family="monospace">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function relationStroke(relation: 'align' | 'collide' | 'separate' | null): string | null {
  if (!relation) return null;
  if (relation === 'align') return '#56ccf2';
  if (relation === 'collide') return '#ff5c5c';
  return '#9bff5c';
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  samples: Float32Array,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const mid = y + h / 2;
  const step = Math.max(1, Math.floor(samples.length / Math.max(1, w)));
  ctx.strokeStyle = '#44ccff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < w; i++) {
    const idx = i * step;
    const v = samples[idx] ?? 0;
    const dy = v * (h / 2);
    const px = x + i;
    if (i === 0) {
      ctx.moveTo(px, mid);
    } else {
      ctx.lineTo(px, mid - dy);
    }
  }
  ctx.stroke();
}

async function loadAudioSamples(
  url: string,
  cacheRef: MutableRefObject<Map<string, Float32Array>>,
  audioCtxRef: MutableRefObject<AudioContext | null>,
  onDone: () => void
) {
  try {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const decoded = await audioCtxRef.current.decodeAudioData(buf);
    const channel = decoded.getChannelData(0);
    const sampleCount = Math.min(2048, channel.length);
    const step = Math.floor(channel.length / sampleCount);
    const samples = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = channel[i * step] ?? 0;
    }
    cacheRef.current.set(url, samples);
    onDone();
  } catch {
    // ignore decode errors
  }
}

function colorFromActor(actorId: string): string {
  let hash = 0;
  for (let i = 0; i < actorId.length; i++) {
    hash = (hash << 5) - hash + actorId.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}
