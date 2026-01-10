import { useEffect, useRef } from 'react';
import type { TileState } from '@metaverse-kit/shadow-canvas';
import { computeRenderState, hasIsolate } from '../rendering/narrative';

interface VoxelCanvasProps {
  tileState: TileState;
}

const GRID_SIZE = 20;

export default function VoxelCanvas({ tileState }: VoxelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid(ctx, canvas.width, canvas.height);

    const nodes = Array.from(tileState.nodes.values());
    const isolateActive = hasIsolate(nodes);
  for (const node of nodes) {
      const renderState = computeRenderState(node, isolateActive);
      const [x, y] = node.transform.position;
      const [sx, sy] = node.transform.scale;
      const vx = Math.round((x + renderState.offset[0]) / GRID_SIZE);
      const vy = Math.round((y + renderState.offset[1]) / GRID_SIZE);

      const px = canvas.width / 2 + vx * GRID_SIZE;
      const py = canvas.height / 2 + vy * GRID_SIZE;
      const w = Math.max(1, Math.round((sx * renderState.scale) / GRID_SIZE)) * GRID_SIZE;
      const h = Math.max(1, Math.round((sy * renderState.scale) / GRID_SIZE)) * GRID_SIZE;

      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, w, h);

      const base = node.deleted
        ? [80, 80, 80]
        : roleTint(node.properties.semantic_role as string | undefined);
      ctx.fillStyle = `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${0.6 * renderState.opacity})`;
      ctx.fillRect(px, py, w, h);
    }
  }, [tileState]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
      }}
    />
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function roleTint(role?: string): [number, number, number] {
  switch (role) {
    case 'law':
      return [255, 190, 90];
    case 'wisdom':
      return [77, 208, 225];
    case 'identity':
      return [129, 199, 132];
    case 'witness':
      return [255, 213, 79];
    case 'boundary':
      return [239, 154, 154];
    case 'gate':
      return [144, 164, 174];
    case 'tower':
      return [255, 138, 101];
    case 'flood':
      return [79, 195, 247];
    case 'ark':
      return [161, 136, 127];
    case 'conversation':
      return [206, 147, 216];
    case 'alignment':
      return [174, 213, 129];
    default:
      return [80, 140, 220];
  }
}
