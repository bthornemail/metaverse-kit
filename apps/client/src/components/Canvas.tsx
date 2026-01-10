import { useEffect, useRef, useState } from 'react';
import type { TileState } from '@metaverse-kit/shadow-canvas';
import { getLiveNodes } from '@metaverse-kit/shadow-canvas';

interface CanvasProps {
  tileState: TileState;
  viewport: { offsetX: number; offsetY: number; scale: number };
  setViewport: (v: any) => void;
  activeTool: 'select' | 'rectangle';
  onCreateRectangle: (x: number, y: number, width: number, height: number) => void;
}

export default function Canvas({
  tileState,
  viewport,
  setViewport,
  activeTool,
  onCreateRectangle,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawEnd, setDrawEnd] = useState({ x: 0, y: 0 });

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
    for (const node of liveNodes) {
      const [x, y] = node.transform.position;
      const [w, h] = node.transform.scale;

      const [sx, sy] = worldToScreen(x, y, viewport);
      const sw = w * viewport.scale;
      const sh = h * viewport.scale;

      // Draw rectangle
      ctx.strokeStyle = (node.properties.color as string) || '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, sh);

      // Draw label
      if (node.properties.label) {
        ctx.fillStyle = '#888';
        ctx.font = '12px monospace';
        ctx.fillText(node.properties.label as string, sx + 4, sy - 4);
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
      ctx.strokeRect(sx1, sy1, sw, sh);
      ctx.setLineDash([]);
    }
  }, [tileState, viewport, isDrawing, drawStart, drawEnd, activeTool]);

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

  function handleMouseDown(e: React.MouseEvent) {
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

  function handleMouseMove(e: React.MouseEvent) {
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
  }

  function handleMouseUp(e: React.MouseEvent) {
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsDragging(false);
        setIsDrawing(false);
      }}
    />
  );
}
