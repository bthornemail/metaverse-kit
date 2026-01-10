import type { NodeState } from '@metaverse-kit/shadow-canvas';

export type NarrativeMeta = {
  actions?: string[];
  intensity?: number; // 0..1
  axis?: 'x' | 'y' | 'z';
  offset?: [number, number, number];
};

export type RenderState = {
  opacity: number;
  scale: number;
  offset: [number, number, number];
  highlight: boolean;
  relation: 'align' | 'collide' | 'separate' | null;
  isolate: boolean;
};

export function getNarrativeMeta(node: NodeState): NarrativeMeta {
  const meta = (node.properties?.narrative ?? {}) as NarrativeMeta;
  return meta;
}

export function hasIsolate(nodes: NodeState[]): boolean {
  return nodes.some((n) => getActions(n).includes('isolate'));
}

export function computeRenderState(
  node: NodeState,
  isolateActive: boolean
): RenderState {
  const meta = getNarrativeMeta(node);
  const actions = getActions(node);
  const intensity = clamp01(meta.intensity ?? 0.5);

  let opacity = 1;
  if (actions.includes('fade') || actions.includes('dim')) opacity = 0.3;
  if (actions.includes('highlight')) opacity = Math.max(opacity, 0.9);
  if (isolateActive && !actions.includes('isolate')) opacity = 0.15;

  let scale = 1;
  if (actions.includes('loom')) scale = 1 + 0.4 * intensity;
  if (actions.includes('recede')) scale = 1 - 0.3 * intensity;
  if (actions.includes('scale')) scale = 1 + 0.2 * intensity;

  const baseOffset = meta.offset ?? hashOffset(node.node_id, 4);
  const offset: [number, number, number] = [...baseOffset];

  if (actions.includes('move') || actions.includes('drift')) {
    offset[0] += baseOffset[0];
    offset[1] += baseOffset[1];
  }
  if (actions.includes('rise')) offset[1] -= 4 * intensity;
  if (actions.includes('fall')) offset[1] += 4 * intensity;

  const relation = actions.includes('align')
    ? 'align'
    : actions.includes('collide')
    ? 'collide'
    : actions.includes('separate')
    ? 'separate'
    : null;

  return {
    opacity,
    scale,
    offset,
    highlight: actions.includes('highlight'),
    relation,
    isolate: actions.includes('isolate'),
  };
}

function getActions(node: NodeState): string[] {
  const meta = getNarrativeMeta(node);
  return Array.isArray(meta.actions) ? meta.actions : [];
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function hashOffset(seed: string, magnitude: number): [number, number, number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const x = ((hash & 0xff) / 255 - 0.5) * magnitude;
  const y = (((hash >> 8) & 0xff) / 255 - 0.5) * magnitude;
  const z = (((hash >> 16) & 0xff) / 255 - 0.5) * magnitude;
  return [x, y, z];
}
