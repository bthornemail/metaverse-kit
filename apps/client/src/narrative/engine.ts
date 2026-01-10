import type { TileState, NodeState } from '@metaverse-kit/shadow-canvas';
import type { NarrativeBeat } from './series';

export type NarrativeFrame = {
  beat: NarrativeBeat;
  index: number;
  progress: number;
  state: TileState;
};

const ROLE_COLORS: Record<string, string> = {
  wisdom: '#4dd0e1',
  law: '#ffb74d',
  identity: '#81c784',
  gate: '#90a4ae',
  measure: '#ba68c8',
  witness: '#ffd54f',
  boundary: '#ef9a9a',
  tower: '#ff8a65',
  flood: '#4fc3f7',
  ark: '#a1887f',
  conversation: '#ce93d8',
  alignment: '#aed581',
  voice: '#64b5f6',
};

export function narrativeFrame(
  beats: NarrativeBeat[],
  t: number
): NarrativeFrame {
  const clamped = Math.max(0, Math.min(1, t));
  const index = Math.min(beats.length - 1, Math.floor(clamped * beats.length));
  const progress = clamped * beats.length - index;
  const beat = beats[index];
  const state = buildNarrativeState(beat, progress);
  return { beat, index, progress, state };
}

function buildNarrativeState(beat: NarrativeBeat, progress: number): TileState {
  const nodes = new Map<string, NodeState>();
  const radius = 80;
  const centerX = 0;
  const centerY = 0;

  beat.roles.forEach((role, idx) => {
    const angle = (idx / beat.roles.length) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const color = ROLE_COLORS[role] ?? '#88a0ff';

    const actions = beat.actions ?? ["spawn", "highlight"];
    nodes.set(`role:${role}`, {
      node_id: `role:${role}`,
      kind: "narrative.role",
      transform: {
        position: [x, y, 0],
        rotation_quat: [0, 0, 0, 1],
        scale: [24, 24, 1],
      },
      properties: {
        label: role,
        color,
        narrative: {
          actions,
          intensity: progress,
          offset: [0, 0, 0],
        },
      },
      links: [],
    });
  });

  return {
    tile_id: `narrative:${beat.id}`,
    nodes,
  };
}
