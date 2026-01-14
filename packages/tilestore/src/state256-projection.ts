import type { Snapshot } from "@metaverse-kit/protocol";
import {
  STATE256_EMPTY,
  STATE256_META_SLOT,
  createEmptyState,
  getState256Meta,
  setState256Meta,
  resolveState256Slot,
} from "@metaverse-kit/state256";
import type { Projection, State256State } from "@metaverse-kit/state256";

export function muxSnapshotToState256(snapshot: Snapshot): State256State {
  const out = createEmptyState();
  setState256Meta(out, {
    projection: "tilestore-snapshot",
    tile_id: snapshot.tile_id,
    at_event: snapshot.at_event,
    state256_root: snapshot.state256_root,
  });

  for (const node of snapshot.nodes) {
    const slot = resolveState256Slot(node.node_id);
    if (slot === null || slot === STATE256_META_SLOT) continue;
    out[slot] = JSON.stringify(node);
  }

  return out;
}

export function demuxSnapshotFromState256(state: State256State): Snapshot {
  const meta = getState256Meta(state);
  const tile_id = meta?.tile_id ?? "tile:state256";
  const at_event = meta?.at_event ?? "";
  const nodes: Snapshot["nodes"] = [];

  for (let i = 0; i < state.length; i++) {
    if (i === STATE256_META_SLOT) continue;
    const atom = state[i];
    if (!atom || atom === STATE256_EMPTY) continue;
    nodes.push(JSON.parse(atom));
  }

  return {
    tile_id,
    at_event,
    state256_root: meta?.state256_root,
    nodes,
  };
}

export const tilestoreSnapshotProjection: Projection<Snapshot> = {
  name: "tilestore-snapshot",
  mux: muxSnapshotToState256,
  demux: demuxSnapshotFromState256,
};
