import test from "node:test";
import assert from "node:assert/strict";
import {
  muxTileStateToState256,
  demuxTileStateFromState256,
} from "../src/state256-projection.ts";
import type { TileState, NodeState } from "../src/index.js";

test("shadow-canvas mux/demux roundtrip", () => {
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

  const input: TileState = { tile_id: "tile:test", nodes };
  const state256 = muxTileStateToState256(input);
  const output = demuxTileStateFromState256(state256);

  assert.equal(output.tile_id, input.tile_id);
  assert.equal(output.nodes.size, input.nodes.size);
  assert.deepEqual(output.nodes.get(nodeA.node_id), nodeA);
  assert.deepEqual(output.nodes.get(nodeB.node_id), nodeB);
});
