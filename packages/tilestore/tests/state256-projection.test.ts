import test from "node:test";
import assert from "node:assert/strict";
import {
  muxSnapshotToState256,
  demuxSnapshotFromState256,
} from "../src/state256-projection.ts";
import type { Snapshot } from "@metaverse-kit/protocol";

test("tilestore snapshot mux/demux roundtrip", () => {
  const snapshot: Snapshot = {
    tile_id: "tile:test",
    at_event: "event:1",
    nodes: [
      {
        node_id: "State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L",
        kind: "shape",
        transform: {
          position: { x: 1, y: 2, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        properties: { color: "red" },
        links: [],
      },
      {
        node_id: "State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.R",
        kind: "shape",
        transform: {
          position: { x: 3, y: 4, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        properties: { color: "blue" },
        links: [],
      },
    ],
  };

  const state256 = muxSnapshotToState256(snapshot);
  const roundtrip = demuxSnapshotFromState256(state256);

  assert.equal(roundtrip.tile_id, snapshot.tile_id);
  assert.equal(roundtrip.at_event, snapshot.at_event);
  assert.equal(roundtrip.nodes.length, snapshot.nodes.length);
  assert.deepEqual(roundtrip.nodes[0], snapshot.nodes[0]);
  assert.deepEqual(roundtrip.nodes[1], snapshot.nodes[1]);
});
