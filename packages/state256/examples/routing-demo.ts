import type { NodeState, TileState } from "@metaverse-kit/shadow-canvas";
import {
  muxTileStateToState256,
  demuxTileStateFromState256,
} from "@metaverse-kit/shadow-canvas";
import {
  muxSnapshotToState256,
  demuxSnapshotFromState256,
} from "@metaverse-kit/tilestore";
import { buildState256, hashRelation, STATE256_EMPTY, STATE256_META_SLOT } from "../src/index.js";

function rootFromState256(state: string[]): string {
  const { root } = buildState256(state);
  return hashRelation(root);
}

function rootIgnoringMeta(state: string[]): string {
  const clone = [...state];
  clone[STATE256_META_SLOT] = STATE256_EMPTY;
  return rootFromState256(clone);
}

const nodes = new Map<string, NodeState>();
const nodeA: NodeState = {
  node_id: "State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L",
  kind: "shape",
  transform: {
    position: { x: 1, y: 2, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  properties: { color: "red" },
  links: [],
};

const nodeB: NodeState = {
  node_id: "State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.R",
  kind: "shape",
  transform: {
    position: { x: 3, y: 4, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  properties: { color: "blue" },
  links: [],
};

nodes.set(nodeA.node_id, nodeA);
nodes.set(nodeB.node_id, nodeB);

const tileState: TileState = { tile_id: "tile:test", nodes };
const stateA = muxTileStateToState256(tileState);
const rootA = rootFromState256(stateA);
const rootAStable = rootIgnoringMeta(stateA);

const snapshot = demuxSnapshotFromState256(stateA);
const stateB = muxSnapshotToState256(snapshot);
const rootB = rootFromState256(stateB);
const rootBStable = rootIgnoringMeta(stateB);

const tileState2 = demuxTileStateFromState256(stateB);
const stateC = muxTileStateToState256(tileState2);
const rootC = rootFromState256(stateC);
const rootCStable = rootIgnoringMeta(stateC);

console.log("route demo");
console.log("tileState -> state256 root:", rootA);
console.log("tileState -> state256 root (no meta):", rootAStable);
console.log("state256 -> snapshot -> state256 root:", rootB);
console.log("state256 -> snapshot -> state256 root (no meta):", rootBStable);
console.log("state256 -> tileState -> state256 root:", rootC);
console.log("state256 -> tileState -> state256 root (no meta):", rootCStable);
console.log("tileState nodes:", tileState.nodes.size);
console.log("tileState2 nodes:", tileState2.nodes.size);
