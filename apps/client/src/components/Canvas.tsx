import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { TileState } from '@metaverse-kit/shadow-canvas';
import { getLiveNodes } from '@metaverse-kit/shadow-canvas';
import type { PresenceUpdate, NodeId, Transform } from '@metaverse-kit/protocol';
import { computeRenderState, hasIsolate } from '../rendering/narrative';
import type { StencilShape } from '../editor/stencils';
import { resolveExt32Assets } from '../ext32';
import { resolveRef } from '../refs';

type LiveNode = ReturnType<typeof getLiveNodes>[number];

interface CanvasProps {
  tileState: TileState;
  viewport: { offsetX: number; offsetY: number; scale: number };
  setViewport: (v: any) => void;
  activeTool: 'select' | 'rectangle' | 'connect' | 'pan';
  selectedIds: NodeId[];
  onSelectionChange: (ids: NodeId[]) => void;
  onCreateNode: (x: number, y: number, width: number, height: number) => void;
  onUpdateTransform: (nodeId: NodeId, transform: Transform) => void;
  onUpdateTransforms: (updates: Array<{ nodeId: NodeId; transform: Transform }>) => void;
  onCreateLink: (from: NodeId, to: NodeId) => void;
  activeStencilShape: StencilShape;
  activeStencilDefaultSize: { w: number; h: number };
  canvasId?: string;
  presence: PresenceUpdate[];
  onCursorMove: (x: number, y: number) => void;
  onContextMenu?: (x: number, y: number) => void;
  onNodeClick?: (nodeId: NodeId) => void;
  onNodeHoverStart?: (nodeId: NodeId) => void;
  onNodeHoverEnd?: (nodeId: NodeId) => void;
  onNodeDragStart?: (nodeId: NodeId, delta: { dx: number; dy: number; dz: number }) => void;
  onNodeDragMove?: (nodeId: NodeId, delta: { dx: number; dy: number; dz: number }) => void;
  onNodeDragEnd?: (nodeId: NodeId) => void;
  onAssetDrop?: (payload: Record<string, unknown>, world: { x: number; y: number }, targetId?: NodeId) => void;
}

export default function Canvas({
  tileState,
  viewport,
  setViewport,
  activeTool,
  selectedIds,
  onSelectionChange,
  onCreateNode,
  onUpdateTransform,
  onUpdateTransforms,
  onCreateLink,
  activeStencilShape,
  activeStencilDefaultSize,
  canvasId,
  presence,
  onCursorMove,
  onContextMenu,
  onNodeClick,
  onNodeHoverStart,
  onNodeHoverEnd,
  onNodeDragStart,
  onNodeDragMove,
  onNodeDragEnd,
  onAssetDrop,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawEnd, setDrawEnd] = useState({ x: 0, y: 0 });
  const [previewTransforms, setPreviewTransforms] = useState<Record<string, Transform>>({});
  const interactionRef = useRef<{
    type: 'pan' | 'move' | 'resize' | 'rotate' | 'connect' | 'select-box' | 'none';
    nodeId?: NodeId;
    handle?: string;
    startWorld?: { x: number; y: number };
    startTransform?: Transform;
    startTransforms?: Record<string, Transform>;
    appendSelection?: boolean;
    connectFrom?: NodeId;
    connectHover?: { x: number; y: number };
  }>({ type: 'none' });
  const [selectionRect, setSelectionRect] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const svgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioCacheRef = useRef<Map<string, Float32Array>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const activePointerId = useRef<number | null>(null);
  const pointerDownNode = useRef<string | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const hoveredNode = useRef<string | null>(null);
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
    const nodeMap = new Map(liveNodes.map((n) => [n.node_id, n]));
    const isolateActive = hasIsolate(liveNodes);

    // Draw links (edges) behind nodes
    for (const node of liveNodes) {
      if (!node.links?.length) continue;
      const from = previewTransforms[node.node_id]
        ? { ...node, transform: previewTransforms[node.node_id] }
        : node;
      for (const link of node.links) {
        const target = nodeMap.get(link.to);
        const to = target && previewTransforms[target.node_id]
          ? { ...target, transform: previewTransforms[target.node_id] }
          : target;
        if (!to) continue;
        drawLink(ctx, from, to, viewport, link.relation);
      }
    }

    for (const node of liveNodes) {
      const renderState = computeRenderState(node, isolateActive);
      const liveTransform = previewTransforms[node.node_id] ?? node.transform;
      const [x, y] = liveTransform.position;
      const [w, h] = liveTransform.scale;
      const worldX = x + renderState.offset[0];
      const worldY = y + renderState.offset[1];
      const angle = angleFromQuat(liveTransform.rotation_quat);

      const [sx, sy] = worldToScreen(worldX, worldY, viewport);
      const sw = w * viewport.scale * renderState.scale;
      const sh = h * viewport.scale * renderState.scale;

      // Draw shape
      ctx.globalAlpha = renderState.opacity;
      ctx.strokeStyle = relationStroke(renderState.relation) || (node.properties.color as string) || '#ffffff';
      ctx.lineWidth = 2;
      drawNodeShape(ctx, sx, sy, sw, sh, angle, (node.properties.stencil_shape as StencilShape) || 'rect');

      if (renderState.highlight) {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 3;
        drawNodeShape(ctx, sx - 2, sy - 2, sw + 4, sh + 4, angle, 'rect');
      }

      const ext32Pack = node.properties?.ext32_pack as string | undefined;
      const ext32Features = Array.isArray(node.properties?.ext32_features)
        ? (node.properties?.ext32_features as string[])
        : [];
      const role = (node.properties?.semantic_role as string | undefined) ?? (node.properties?.label as string | undefined);
      const ext32Assets = ext32Pack ? resolveExt32Assets(ext32Pack, role, ext32Features) : null;

      // Draw SVG projection if available
      const svgRef =
        node.geometry?.kind === 'svg'
          ? node.geometry.ref
          : node.media?.kind === 'svg'
          ? node.media.ref
          : ext32Assets?.svg ?? null;
      if (svgRef) {
        const url = resolveRef(svgRef, () => setSvgTick((t) => t + 1));
        if (!url) {
          continue;
        }
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

      if (node.media?.kind === 'mp4' || ext32Assets?.mp4) {
        const ref = node.media?.kind === 'mp4' ? node.media.ref : ext32Assets?.mp4;
        if (!ref) {
          continue;
        }
        const url = resolveRef(ref, () => setVideoTick((t) => t + 1));
        if (!url) {
          continue;
        }
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

      if (node.media?.kind === 'wav' || ext32Assets?.wav) {
        const ref = node.media?.kind === 'wav' ? node.media.ref : ext32Assets?.wav;
        if (!ref) {
          continue;
        }
        const url = resolveRef(ref, () => setSvgTick((t) => t + 1));
        if (!url) {
          continue;
        }
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

    // Draw selection boxes/handles
    if (selectedIds.length) {
      for (const id of selectedIds) {
        const node = nodeMap.get(id);
        if (!node) continue;
        const liveTransform = previewTransforms[node.node_id] ?? node.transform;
        const [x, y] = liveTransform.position;
        const [w, h] = liveTransform.scale;
        const [sx, sy] = worldToScreen(x, y, viewport);
        const sw = w * viewport.scale;
        const sh = h * viewport.scale;
        ctx.strokeStyle = '#44ccff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx, sy, sw, sh);
        drawHandles(ctx, sx, sy, sw, sh);
      }
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
      drawNodeShape(ctx, sx1, sy1, sw, sh, 0, activeStencilShape);
      ctx.setLineDash([]);
    }

    // Draw connector preview
    if (interactionRef.current.type === 'connect' && interactionRef.current.connectFrom && interactionRef.current.connectHover) {
      const from = nodeMap.get(interactionRef.current.connectFrom);
      if (from) {
        const to = interactionRef.current.connectHover;
        const [fx, fy] = worldToScreen(from.transform.position[0], from.transform.position[1], viewport);
        const [tx, ty] = worldToScreen(to.x, to.y, viewport);
        ctx.strokeStyle = '#ffa55c';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (selectionRect) {
      const [sx, sy] = worldToScreen(selectionRect.x, selectionRect.y, viewport);
      const [sx2, sy2] = worldToScreen(selectionRect.x + selectionRect.w, selectionRect.y + selectionRect.h, viewport);
      ctx.strokeStyle = '#4488ff';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sx, sy, sx2 - sx, sy2 - sy);
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
  }, [
    tileState,
    viewport,
    isDrawing,
    drawStart,
    drawEnd,
    activeTool,
    presence,
    svgTick,
    videoTick,
    selectedIds,
    activeStencilShape,
    previewTransforms,
    selectionRect,
  ]);

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

  function handleWheelNative(e: WheelEvent) {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      handleWheelNative(e);
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [viewport]);

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    (e.target as Element).setPointerCapture(e.pointerId);

    const [wx, wy] = screenToWorld(e.clientX, e.clientY, viewport);
    const liveNodes = getLiveNodes(tileState);
    const hitNode = hitTestNode(liveNodes, wx, wy);
    pointerDownNode.current = hitNode?.node_id ?? null;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };

    if (activeTool === 'pan' || e.button === 2) {
      interactionRef.current = { type: 'pan', startWorld: { x: wx, y: wy } };
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (activeTool === 'connect' && hitNode) {
      interactionRef.current = {
        type: 'connect',
        connectFrom: hitNode.node_id,
        connectHover: { x: wx, y: wy },
      };
      return;
    }

    const handle = hitNode && selectedIds.includes(hitNode.node_id)
      ? hitTestHandle(hitNode, wx, wy, viewport)
      : null;

    if (handle && hitNode) {
      interactionRef.current = {
        type: handle === 'rotate' ? 'rotate' : 'resize',
        nodeId: hitNode.node_id,
        handle,
        startWorld: { x: wx, y: wy },
        startTransform: hitNode.transform,
      };
      return;
    }

    if (activeTool === 'select' && hitNode) {
      const shouldMulti = selectedIds.includes(hitNode.node_id) && selectedIds.length > 0;
      if (e.shiftKey) {
        if (selectedIds.includes(hitNode.node_id)) {
          onSelectionChange(selectedIds.filter((id) => id !== hitNode.node_id));
        } else {
          onSelectionChange([...selectedIds, hitNode.node_id]);
        }
      } else {
        onSelectionChange([hitNode.node_id]);
      }
      interactionRef.current = {
        type: 'move',
        nodeId: hitNode.node_id,
        startWorld: { x: wx, y: wy },
        startTransform: hitNode.transform,
        startTransforms: shouldMulti
          ? Object.fromEntries(
              selectedIds.map((id) => {
                const node = liveNodes.find((n) => n.node_id === id);
                return node ? [id, node.transform] : null;
              }).filter(Boolean) as Array<[string, Transform]>
            )
          : { [hitNode.node_id]: hitNode.transform },
      };
      onNodeDragStart?.(hitNode.node_id, { dx: 0, dy: 0, dz: 0 });
      return;
    }

    if (activeTool === 'select' && !hitNode) {
      if (!e.shiftKey) {
        onSelectionChange([]);
      }
      interactionRef.current = {
        type: 'select-box',
        startWorld: { x: wx, y: wy },
        appendSelection: e.shiftKey,
      };
      setSelectionRect({ x: wx, y: wy, w: 0, h: 0 });
      return;
    }

    if (activeTool === 'rectangle') {
      // Draw mode
      setIsDrawing(true);
      setDrawStart({ x: wx, y: wy });
      setDrawEnd({ x: wx, y: wy });
      return;
    }

    if (!e.shiftKey) {
      onSelectionChange([]);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (activePointerId.current !== e.pointerId) return;
    const [wx, wy] = screenToWorld(e.clientX, e.clientY, viewport);
    const liveNodes = getLiveNodes(tileState);
    const hoverHit = hitTestNode(liveNodes, wx, wy);
    const hoverId = hoverHit?.node_id ?? null;
    if (hoverId !== hoveredNode.current) {
      if (hoveredNode.current) {
        onNodeHoverEnd?.(hoveredNode.current);
      }
      if (hoverId) {
        onNodeHoverStart?.(hoverId);
      }
      hoveredNode.current = hoverId;
    }

    if (interactionRef.current.type === 'pan' && isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      setViewport({
        ...viewport,
        offsetX: viewport.offsetX + dx,
        offsetY: viewport.offsetY + dy,
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (interactionRef.current.type === 'move' && interactionRef.current.startTransforms) {
      const dx = wx - (interactionRef.current.startWorld?.x ?? wx);
      const dy = wy - (interactionRef.current.startWorld?.y ?? wy);
      const nextTransforms: Record<string, Transform> = {};
      for (const [id, transform] of Object.entries(interactionRef.current.startTransforms)) {
        nextTransforms[id] = moveTransform(transform, dx, dy, liveNodes, id);
      }
      setPreviewTransforms((prev) => ({ ...prev, ...nextTransforms }));
      if (interactionRef.current.nodeId) {
        onNodeDragMove?.(interactionRef.current.nodeId, { dx, dy, dz: 0 });
      }
    } else if (interactionRef.current.type === 'resize' && interactionRef.current.nodeId && interactionRef.current.startTransform) {
      const next = resizeTransform(
        interactionRef.current.startTransform,
        interactionRef.current.handle ?? 'se',
        wx,
        wy,
        liveNodes,
        interactionRef.current.nodeId
      );
      setPreviewTransforms((prev) => ({ ...prev, [interactionRef.current.nodeId as string]: next }));
    } else if (interactionRef.current.type === 'rotate' && interactionRef.current.nodeId && interactionRef.current.startTransform) {
      const next = rotateTransform(
        interactionRef.current.startTransform,
        wx,
        wy
      );
      setPreviewTransforms((prev) => ({ ...prev, [interactionRef.current.nodeId as string]: next }));
    } else if (isDrawing && activeTool === 'rectangle') {
      setDrawEnd({ x: wx, y: wy });
    } else if (interactionRef.current.type === 'connect' && interactionRef.current.connectFrom) {
      interactionRef.current.connectHover = { x: wx, y: wy };
    } else if (interactionRef.current.type === 'select-box' && interactionRef.current.startWorld) {
      const start = interactionRef.current.startWorld;
      const rect = {
        x: Math.min(start.x, wx),
        y: Math.min(start.y, wy),
        w: Math.abs(wx - start.x),
        h: Math.abs(wy - start.y),
      };
      setSelectionRect(rect);
    }

    onCursorMove(wx, wy);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (activePointerId.current !== e.pointerId) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    activePointerId.current = null;

    if (isDragging) {
      setIsDragging(false);
    } else if (interactionRef.current.type === 'connect' && interactionRef.current.connectFrom) {
      const [wx, wy] = screenToWorld(e.clientX, e.clientY, viewport);
      const liveNodes = getLiveNodes(tileState);
      const hitNode = hitTestNode(liveNodes, wx, wy);
      if (hitNode && hitNode.node_id !== interactionRef.current.connectFrom) {
        onCreateLink(interactionRef.current.connectFrom, hitNode.node_id);
      }
    } else if (isDrawing && activeTool === 'rectangle') {
      setIsDrawing(false);

      // Create rectangle
      const x = Math.min(drawStart.x, drawEnd.x);
      const y = Math.min(drawStart.y, drawEnd.y);
      const width = Math.abs(drawEnd.x - drawStart.x);
      const height = Math.abs(drawEnd.y - drawStart.y);

      // Only create if rectangle has meaningful size
      if (width > 1 && height > 1) {
        onCreateNode(x, y, width, height);
      } else {
        const w = activeStencilDefaultSize.w;
        const h = activeStencilDefaultSize.h;
        onCreateNode(drawStart.x - w / 2, drawStart.y - h / 2, w, h);
      }
    }

    if (interactionRef.current.type === 'move' && interactionRef.current.startTransforms) {
      const updates = Object.entries(previewTransforms).map(([nodeId, transform]) => ({
        nodeId,
        transform,
      }));
      if (updates.length) {
        onUpdateTransforms(updates);
      }
      setPreviewTransforms({});
      if (interactionRef.current.nodeId) {
        onNodeDragEnd?.(interactionRef.current.nodeId);
      }
    }

    if (
      (interactionRef.current.type === 'resize' ||
        interactionRef.current.type === 'rotate') &&
      interactionRef.current.nodeId
    ) {
      const nodeId = interactionRef.current.nodeId;
      const preview = previewTransforms[nodeId];
      if (preview) {
        onUpdateTransform(nodeId, preview);
      }
      setPreviewTransforms({});
    }

    if (interactionRef.current.type === 'select-box' && selectionRect) {
      const liveNodes = getLiveNodes(tileState);
      const selected = liveNodes
        .filter((node) =>
          node.transform.position[0] >= selectionRect.x &&
          node.transform.position[1] >= selectionRect.y &&
          node.transform.position[0] + node.transform.scale[0] <= selectionRect.x + selectionRect.w &&
          node.transform.position[1] + node.transform.scale[1] <= selectionRect.y + selectionRect.h
        )
        .map((node) => node.node_id);
      if (interactionRef.current.appendSelection) {
        const merged = Array.from(new Set([...selectedIds, ...selected]));
        onSelectionChange(merged);
      } else {
        onSelectionChange(selected);
      }
      setSelectionRect(null);
    }

    if (pointerDownNode.current && activeTool === 'select') {
      const dx = Math.abs(e.clientX - (pointerDownPos.current?.x ?? e.clientX));
      const dy = Math.abs(e.clientY - (pointerDownPos.current?.y ?? e.clientY));
      if (dx < 4 && dy < 4) {
        onNodeClick?.(pointerDownNode.current);
      }
    }
    pointerDownNode.current = null;
    pointerDownPos.current = null;

    interactionRef.current = { type: 'none' };
  }

  return (
    <canvas
      ref={canvasRef}
      id={canvasId}
      style={{
        display: 'block',
        cursor:
          activeTool === 'pan'
            ? isDragging
              ? 'grabbing'
              : 'grab'
            : activeTool === 'connect'
            ? 'crosshair'
            : 'default',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e.clientX, e.clientY);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDragOver={(e) => {
        if (!onAssetDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        if (!onAssetDrop) return;
        e.preventDefault();
        const raw = e.dataTransfer.getData('application/x-mvk-asset');
        if (!raw) return;
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return;
        }
        const [wx, wy] = screenToWorld(e.clientX, e.clientY, viewport);
        const liveNodes = getLiveNodes(tileState);
        const hitNode = hitTestNode(liveNodes, wx, wy);
        onAssetDrop(parsed ?? {}, { x: wx, y: wy }, hitNode?.node_id);
      }}
      onMouseLeave={() => {
        setIsDragging(false);
        setIsDrawing(false);
        activePointerId.current = null;
        interactionRef.current = { type: 'none' };
        setPreviewTransforms({});
        setSelectionRect(null);
      }}
    />
  );
}

function angleFromQuat(q: [number, number, number, number]) {
  const [, , z, w] = q;
  return 2 * Math.atan2(z, w);
}

function quatFromAngle(angle: number): [number, number, number, number] {
  const half = angle / 2;
  return [0, 0, Math.sin(half), Math.cos(half)];
}

function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  shape: StencilShape
) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  ctx.translate(-w / 2, -h / 2);

  if (shape === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(0, h / 2);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.strokeRect(0, 0, w, h);
  }

  ctx.restore();
}

function drawHandles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const size = 6;
  const points = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];
  ctx.fillStyle = '#111';
  ctx.strokeStyle = '#44ccff';
  for (const [px, py] of points) {
    ctx.beginPath();
    ctx.rect(px - size / 2, py - size / 2, size, size);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x + w / 2, y - 14, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawLink(
  ctx: CanvasRenderingContext2D,
  from: { transform: Transform },
  to: { transform: Transform },
  viewport: { offsetX: number; offsetY: number; scale: number },
  relation: string
) {
  const [label, route = 'orth'] = String(relation).split('::');
  const fx = from.transform.position[0];
  const fy = from.transform.position[1];
  const tx = to.transform.position[0];
  const ty = to.transform.position[1];
  const midX = (fx + tx) / 2;
  const [sfx, sfy] = worldToScreenStatic(fx, fy, viewport);
  const [stx, sty] = worldToScreenStatic(tx, ty, viewport);
  const [smx, smy] = worldToScreenStatic(midX, fy, viewport);

  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sfx, sfy);
  if (route === 'straight') {
    ctx.lineTo(stx, sty);
  } else if (route === 'bezier') {
    const ctrlX = (sfx + stx) / 2;
    ctx.quadraticCurveTo(ctrlX, sfy - 40, stx, sty);
  } else {
    ctx.lineTo(smx, smy);
    ctx.lineTo(stx, sty);
  }
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(sty - sfy, stx - sfx);
  const arrowSize = 6;
  ctx.beginPath();
  ctx.moveTo(stx, sty);
  ctx.lineTo(stx - arrowSize * Math.cos(angle - 0.4), sty - arrowSize * Math.sin(angle - 0.4));
  ctx.lineTo(stx - arrowSize * Math.cos(angle + 0.4), sty - arrowSize * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fillStyle = '#666';
  ctx.fill();

  if (label) {
    ctx.fillStyle = '#777';
    ctx.font = '10px monospace';
    ctx.fillText(label, smx + 4, smy - 4);
  }
}

function worldToScreenStatic(
  x: number,
  y: number,
  vp: { offsetX: number; offsetY: number; scale: number }
): [number, number] {
  return [x * vp.scale + vp.offsetX, y * vp.scale + vp.offsetY];
}

function hitTestNode(nodes: LiveNode[], x: number, y: number) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const [nx, ny] = node.transform.position;
    const [w, h] = node.transform.scale;
    if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
      return node;
    }
  }
  return null;
}

function hitTestHandle(
  node: { transform: Transform },
  x: number,
  y: number,
  viewport: { offsetX: number; offsetY: number; scale: number }
) {
  const [nx, ny] = node.transform.position;
  const [w, h] = node.transform.scale;
  const handleSize = 8 / viewport.scale;
  const handles = [
    { id: 'nw', x: nx, y: ny },
    { id: 'ne', x: nx + w, y: ny },
    { id: 'sw', x: nx, y: ny + h },
    { id: 'se', x: nx + w, y: ny + h },
  ];
  for (const handle of handles) {
    if (Math.abs(x - handle.x) <= handleSize && Math.abs(y - handle.y) <= handleSize) {
      return handle.id;
    }
  }
  if (Math.abs(x - (nx + w / 2)) <= handleSize && Math.abs(y - (ny - 14 / viewport.scale)) <= handleSize) {
    return 'rotate';
  }
  return null;
}

function moveTransform(
  transform: Transform,
  dx: number,
  dy: number,
  nodes: LiveNode[],
  nodeId: string
) {
  const [x, y, z] = transform.position;
  const snapped = snapPosition(x + dx, y + dy, transform.scale, nodes, nodeId, false);
  return {
    ...transform,
    position: [snapped.x, snapped.y, z],
  };
}

function resizeTransform(
  transform: Transform,
  handle: string,
  x: number,
  y: number,
  nodes: LiveNode[],
  nodeId: string
) {
  const [px, py, pz] = transform.position;
  const [w, h, sz] = transform.scale;
  let nx = px;
  let ny = py;
  let nw = w;
  let nh = h;

  if (handle.includes('e')) {
    nw = Math.max(10, x - px);
  }
  if (handle.includes('s')) {
    nh = Math.max(10, y - py);
  }
  if (handle.includes('w')) {
    nw = Math.max(10, w + (px - x));
    nx = x;
  }
  if (handle.includes('n')) {
    nh = Math.max(10, h + (py - y));
    ny = y;
  }

  const snapped = snapPosition(nx, ny, [nw, nh, sz], nodes, nodeId, true);
  return {
    ...transform,
    position: [snapped.x, snapped.y, pz],
    scale: [snapped.w, snapped.h, sz],
  };
}

function rotateTransform(transform: Transform, x: number, y: number) {
  const [px, py] = transform.position;
  const [w, h] = transform.scale;
  const cx = px + w / 2;
  const cy = py + h / 2;
  const angle = Math.atan2(y - cy, x - cx);
  return {
    ...transform,
    rotation_quat: quatFromAngle(angle),
  };
}

function snapPosition(
  x: number,
  y: number,
  scale: [number, number, number],
  nodes: LiveNode[],
  nodeId: string,
  snapSize: boolean
) {
  const grid = 25;
  const threshold = 6;
  let sx = Math.round(x / grid) * grid;
  let sy = Math.round(y / grid) * grid;
  let sw = scale[0];
  let sh = scale[1];
  if (snapSize) {
    sw = Math.round(scale[0] / grid) * grid;
    sh = Math.round(scale[1] / grid) * grid;
  }

  for (const node of nodes) {
    if (node.node_id === nodeId) continue;
    const [nx, ny] = node.transform.position;
    const [nw, nh] = node.transform.scale;
    if (Math.abs(nx - sx) < threshold) sx = nx;
    if (Math.abs(ny - sy) < threshold) sy = ny;
    if (snapSize) {
      if (Math.abs(nx + nw - (sx + sw)) < threshold) sw = nw;
      if (Math.abs(ny + nh - (sy + sh)) < threshold) sh = nh;
    }
  }

  return { x: sx, y: sy, w: sw, h: sh };
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
