import type { TileState, NodeState } from "./index.js";
import {
  STATE256_EMPTY,
  STATE256_META_SLOT,
  createEmptyState,
  getState256Meta,
  setState256Meta,
  resolveState256Slot,
} from "@metaverse-kit/state256";
import type { Projection, State256State } from "@metaverse-kit/state256";

export function muxTileStateToState256(state: TileState): State256State {
  const out = createEmptyState();
  setState256Meta(out, { projection: "shadow-canvas", tile_id: state.tile_id });

  for (const node of state.nodes.values()) {
    const slot = resolveState256Slot(node.node_id);
    if (slot === null || slot === STATE256_META_SLOT) continue;
    out[slot] = JSON.stringify(node);
  }

  return out;
}

export function demuxTileStateFromState256(state: State256State): TileState {
  const meta = getState256Meta(state);
  const tile_id = meta?.tile_id ?? "tile:state256";
  const nodes = new Map<string, NodeState>();

  for (let i = 0; i < state.length; i++) {
    if (i === STATE256_META_SLOT) continue;
    const atom = state[i];
    if (!atom || atom === STATE256_EMPTY) continue;
    const node = JSON.parse(atom) as NodeState;
    nodes.set(node.node_id, node);
  }

  return { tile_id, nodes };
}

export const shadowCanvasProjection: Projection<TileState> = {
  name: "shadow-canvas",
  mux: muxTileStateToState256,
  demux: demuxTileStateFromState256,
};
