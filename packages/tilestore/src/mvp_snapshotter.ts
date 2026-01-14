import type { Snapshot } from "@metaverse-kit/protocol";
import { computeState256Root } from "@metaverse-kit/state256";
import type { Snapshotter } from "./snapshot.js";

export const MVPSnapshotter: Snapshotter = {
  async buildSnapshot({ tile_id, lastSnapshot, segmentTexts }) {
    const state = new Map<string, any>();
    if (lastSnapshot) {
      for (const n of lastSnapshot.nodes) state.set(n.node_id, { ...n });
    }

    let at_event = lastSnapshot?.at_event ?? "";

    for (const seg of segmentTexts) {
      const lines = seg.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        const ev = JSON.parse(line);
        at_event = ev.event_id;

        switch (ev.operation) {
          case "create_node":
            if (!state.has(ev.node_id)) {
              state.set(ev.node_id, {
                node_id: ev.node_id,
                kind: ev.kind,
                transform: ev.transform,
                properties: ev.properties ?? {},
                deleted: false,
              });
            }
            break;

          case "update_transform": {
            const n = state.get(ev.node_id);
            if (n && !n.deleted) n.transform = ev.transform;
            break;
          }

          case "set_properties": {
            const n = state.get(ev.node_id);
            if (n && !n.deleted) {
              n.properties = n.properties ?? {};
              for (const [k, v] of Object.entries(ev.properties ?? {})) {
                n.properties[k] = v;
              }
            }
            break;
          }

          case "delete_node": {
            const n = state.get(ev.node_id);
            if (n) n.deleted = true;
            break;
          }

          default:
            break;
        }
      }
    }

    const nodes = Array.from(state.values());
    const state256_root = computeState256Root(nodes, { includeDeleted: false });

    return {
      tile_id,
      at_event,
      state256_root,
      nodes,
    } satisfies Snapshot;
  },
};
