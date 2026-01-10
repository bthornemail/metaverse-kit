import type { SpaceId, TileId, TileState, Segment, HashRef } from "./types.js";

export class TileStore {
  private state = new Map<string, TileState>();
  private segments = new Map<HashRef, Segment>();

  private key(space: SpaceId, tile: TileId) {
    return `${space}:${tile}`;
  }

  getTileState(space: SpaceId, tile: TileId): TileState {
    const k = this.key(space, tile);
    const found = this.state.get(k);
    if (found) return found;

    const init: TileState = {
      space,
      tile,
      tip: "sha256:GENESIS",
      updatedAtMs: Date.now(),
    };
    this.state.set(k, init);
    return init;
  }

  getSegmentsSince(tip: HashRef, max = 64): Segment[] {
    const out: Segment[] = [];
    let cur: HashRef | undefined = tip;
    while (cur && out.length < max) {
      const seg = this.segments.get(cur);
      if (!seg) break;
      out.push(seg);
      cur = seg.prev;
    }
    return out;
  }

  appendSegment(space: SpaceId, tile: TileId, seg: Segment) {
    this.segments.set(seg.hash, seg);
    const st = this.getTileState(space, tile);
    this.state.set(this.key(space, tile), {
      ...st,
      tip: seg.hash,
      updatedAtMs: Date.now(),
    });
  }
}
