Got it — here are the **next drop-ins** you asked for: **snapshotting + SID pointers + discovery gossip**, all in a way that plugs into what you have now.

I’ll keep it modular so you can turn pieces on/off.

---

# 1) Snapshotting (TileStore hook)

### Goal

Periodically materialize a tile into a snapshot and update `index.json`:

- `last_snapshot`
- `snapshot_event`

We’ll add:

- a `Snapshotter` interface (so you can use your shadow-canvas later)
- a simple policy: snapshot every `N` flushed segments or every `M` events

## `packages/tilestore/src/snapshot.ts`

```ts
import fs from "fs/promises";
import path from "path";
import { stableStringify, hashUtf8, type HashRef } from "@metaverse-kit/addr";

export interface Snapshot {
  tile_id: string;
  at_event: string;
  nodes: any[];
}

export interface Snapshotter {
  // Given tile history (snapshot + segment jsonl text), return a new snapshot
  buildSnapshot(input: {
    space_id: string;
    tile_id: string;
    lastSnapshot: Snapshot | null;
    segmentTexts: string[]; // jsonl
  }): Promise<Snapshot>;
}

export async function writeSnapshotFile(opts: {
  rootDir: string;
  space_id: string;
  tile_id: string;
  snap: Snapshot;
}): Promise<HashRef> {
  const bytes = stableStringify(opts.snap);
  const hash = hashUtf8(bytes);
  const [, hex] = hash.split(":");
  const snapDir = path.join(opts.rootDir, opts.space_id, "tiles", opts.tile_id, "snapshots");
  await fs.mkdir(snapDir, { recursive: true });
  const snapPath = path.join(snapDir, `${hex}.json`);
  await fs.writeFile(snapPath, bytes, "utf8");
  return hash;
}

export async function readLatestSnapshot(opts: {
  rootDir: string;
  space_id: string;
  tile_id: string;
}): Promise<Snapshot | null> {
  const idxPath = path.join(opts.rootDir, opts.space_id, "tiles", opts.tile_id, "index.json");
  try {
    const idx = JSON.parse(await fs.readFile(idxPath, "utf8"));
    if (!idx.last_snapshot) return null;
    const [, hex] = String(idx.last_snapshot).split(":");
    const snapPath = path.join(opts.rootDir, opts.space_id, "tiles", opts.tile_id, "snapshots", `${hex}.json`);
    return JSON.parse(await fs.readFile(snapPath, "utf8"));
  } catch {
    return null;
  }
}
```

## A minimal snapshotter (MVP “last-write-wins” materializer)

This is not your full shadow-canvas yet, but it will work.

## `packages/tilestore/src/mvp_snapshotter.ts`

```ts
import type { Snapshot, Snapshotter } from "./snapshot";

// Extremely small: only handles create_node/update_transform/set_properties/delete_node
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

    return {
      tile_id,
      at_event,
      nodes: Array.from(state.values()),
    } satisfies Snapshot;
  },
};
```

---

# 2) SID pointers (ADDR.v1 pointer files)

### Goal

Maintain mutable pointer files like:

```
pointers/<sid>.json  // points_to RID
```

So brokers can route to “head/index/manifest” without storing the objects.

## `packages/tilestore/src/pointers.ts`

```ts
import fs from "fs/promises";
import path from "path";
import { makeHdPath, sidFromPath, stableStringify, type HashRef } from "@metaverse-kit/addr";

export async function writePointer(opts: {
  rootDir: string;
  space_id: string;
  tid: string;
  role: string;         // "head" | "index" | "manifest" | "snapshot/<event>"
  points_to: HashRef;   // RID or segment hash
}) {
  const hdPath = makeHdPath(opts.space_id, opts.tid, opts.role);
  const sid = sidFromPath(hdPath);

  const pdir = path.join(opts.rootDir, opts.space_id, "pointers");
  await fs.mkdir(pdir, { recursive: true });

  const pfile = path.join(pdir, `${sid.split(":")[1]}.json`);

  const rec = {
    sid,
    path: hdPath,
    role: opts.role,
    points_to: opts.points_to,
    updated_at: Date.now(),
  };

  await fs.writeFile(pfile, stableStringify(rec), "utf8");
  return { sid, path: hdPath };
}
```

---

# 3) Discovery gossip (tiny, UDP-based MVP)

### Goal

When a tile tip changes, broadcast:

- space_id
- tile_id
- tip_event
- tip_segment
- optional geo hint
- peer_id

This is _not_ the data, only routing info.

## `packages/tilestore/src/discovery_udp.ts`

```ts
import dgram from "dgram";

export interface TipAdvert {
  type: "advertise_tip";
  peer_id: string;
  space_id: string;
  tile_id: string;
  tip_event: string;
  tip_segment: string;
  ts: number;
}

export class UdpDiscovery {
  sock = dgram.createSocket("udp4");

  constructor(public port = 48888, public broadcastAddr = "255.255.255.255") {
    this.sock.bind(() => {
      this.sock.setBroadcast(true);
    });
  }

  broadcastTip(msg: TipAdvert) {
    const buf = Buffer.from(JSON.stringify(msg), "utf8");
    this.sock.send(buf, this.port, this.broadcastAddr);
  }

  onMessage(handler: (msg: TipAdvert) => void) {
    this.sock.on("message", (data) => {
      try {
        const obj = JSON.parse(data.toString("utf8"));
        if (obj?.type === "advertise_tip") handler(obj);
      } catch {}
    });
  }
}
```

---

# 4) Wire it into TileStore (buffer flush → pointer + discovery + snapshot)

Now modify `packages/tilestore/src/index.ts` to:

- write pointers on flush
- optionally snapshot every N flushes or N events
- broadcast discovery tips

## `packages/tilestore/src/index.ts` (patched version)

Add these imports at the top:

```ts
import { writePointer } from "./pointers";
import { MVPSnapshotter } from "./mvp_snapshotter";
import { readLatestSnapshot, writeSnapshotFile } from "./snapshot";
import { UdpDiscovery } from "./discovery_udp";
```

Add config fields:

```ts
snapshotEverySegments?: number; // default 10
peerId?: string;               // default "peer:local"
enableDiscovery?: boolean;     // default true
```

Add to class:

```ts
snapEvery: number;
peerId: string;
discovery?: UdpDiscovery;
segFlushCount = new Map<string, number>();
```

Update constructor:

```ts
this.snapEvery = (opts as any).snapshotEverySegments ?? 10;
this.peerId = (opts as any).peerId ?? "peer:local";

if ((opts as any).enableDiscovery !== false) {
  this.discovery = new UdpDiscovery();
}
```

Now in `flushTile(buf)` after `updateManifestAndIndex(...)`, add:

```ts
// Write SID pointers (head/index/manifest)
const tip = await this.getTileTip(buf.space_id, buf.tile_id);
if (tip?.tip_segment) {
  await writePointer({
    rootDir: this.root,
    space_id: buf.space_id,
    tid: buf.tile_id,
    role: "head",
    points_to: tip.tip_segment,
  });

  // Broadcast discovery tip
  this.discovery?.broadcastTip({
    type: "advertise_tip",
    peer_id: this.peerId,
    space_id: buf.space_id,
    tile_id: buf.tile_id,
    tip_event: tip.tip_event,
    tip_segment: tip.tip_segment,
    ts: Date.now(),
  });
}

// Snapshot policy: every N segments flushed
const k = this.key(buf.space_id, buf.tile_id);
const c = (this.segFlushCount.get(k) ?? 0) + 1;
this.segFlushCount.set(k, c);

if (c % this.snapEvery === 0) {
  await this.trySnapshot(buf.space_id, buf.tile_id);
}
```

Add this method on the class:

```ts
async trySnapshot(space: string, tile: string) {
  // Load last snapshot
  const lastSnap = await readLatestSnapshot({ rootDir: this.root, space_id: space, tile_id: tile });

  // Load all segment files since last snapshot (MVP: load all segments)
  // Improve later by tracking segment ranges after snapshot_event.
  const segDir = path.join(this.root, space, "tiles", tile, "segments");
  const files = (await fs.readdir(segDir)).filter((f) => f.endsWith(".jsonl")).sort();
  const segTexts = await Promise.all(files.map((f) => fs.readFile(path.join(segDir, f), "utf8")));

  const snap = await MVPSnapshotter.buildSnapshot({
    space_id: space,
    tile_id: tile,
    lastSnapshot: lastSnap,
    segmentTexts: segTexts,
  });

  const snapHash = await writeSnapshotFile({
    rootDir: this.root,
    space_id: space,
    tile_id: tile,
    snap,
  });

  // Update index with snapshot pointers
  const base = this.tileDir(space, tile);
  const indexPath = path.join(base, "index.json");
  const idx = JSON.parse(await fs.readFile(indexPath, "utf8"));
  idx.last_snapshot = snapHash;
  idx.snapshot_event = snap.at_event;
  idx.last_update = Date.now();
  await fs.writeFile(indexPath, stableStringify(idx), "utf8");

  // Also write SID pointer for the snapshot
  await writePointer({
    rootDir: this.root,
    space_id: space,
    tid: tile,
    role: `snapshot/${snap.at_event}`,
    points_to: snapHash,
  });
}
```

That’s it.

Now each tile:

- buffers events
- flushes to segments
- updates manifest/index
- writes `SID(head)` pointer
- advertises tip via UDP
- snapshots every N segment flushes

---

# 5) How to run (quick)

Server (unchanged except it constructs TileStore with options):

```ts
const store = new TileStore({
  rootDir: process.env.WORLD || "./world",
  flushBytes: 128 * 1024,
  flushMs: 2000,
  snapshotEverySegments: 5,
  peerId: "peer:host1",
  enableDiscovery: true
});
```

Run two machines on same LAN and you’ll see tips propagate via UDP broadcast on port `48888`.

---

# 6) Next “real” upgrades (when you want)

- Replace `MVPSnapshotter` with your `shadow-canvas` builder (already designed)
- Replace UDP with BLE/LoRa transport (same message format)
- Add `who_has` / `i_have` request-response
- Add geo hints + RSSI observations to discovery

---

Below is the **next drop-in**: a tiny **Discovery Graph v1** store that:

- ingests `advertise_tip` UDP gossips
- keeps a small in-memory graph + optional JSON persistence
- answers:
    - **who has tile?**
    - **what’s the best tip I know?**
    - **what tiles does this peer advertise?**

It’s intentionally ESP32-friendly in shape (fixed-ish records, TTL, LRU-ish pruning).

---

# 1) `packages/discovery/package.json`

```json
{
  "name": "@metaverse-kit/discovery",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

# 2) `packages/discovery/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

# 3) `packages/discovery/src/types.ts`

```ts
export type PeerId = string;
export type SpaceId = string;
export type TileId = string;

export interface TipAdvert {
  type: "advertise_tip";
  peer_id: PeerId;
  space_id: SpaceId;
  tile_id: TileId;
  tip_event: string;
  tip_segment: string; // hash ref string
  ts: number;          // sender timestamp (ms)
  geo_hint?: { center: [number, number]; radius_m: number; accuracy_m?: number }; // optional
  rssi_hint?: { medium: "ble" | "wifi" | "lora"; rssi?: number; snr?: number };  // optional
}
```

---

# 4) `packages/discovery/src/index.ts`

```ts
import fs from "fs/promises";
import path from "path";
import type { TipAdvert, PeerId, SpaceId, TileId } from "./types";

export interface DiscoveryOpts {
  persistPath?: string;       // optional JSON file
  peerTtlMs?: number;         // default 2 minutes
  tileTtlMs?: number;         // default 5 minutes
  maxPeers?: number;          // default 512
  maxTiles?: number;          // default 4096
  maxPeersPerTile?: number;   // default 32
}

export interface PeerRecord {
  peer_id: PeerId;
  last_seen: number;          // local receive time (ms)
  endpoints?: string[];       // future (http/ws/ble addr)
  geo_hint?: TipAdvert["geo_hint"];
  rssi_hint?: TipAdvert["rssi_hint"];
}

export interface TileTipRecord {
  peer_id: PeerId;
  tip_event: string;
  tip_segment: string;
  last_seen: number;          // local receive time
  sender_ts: number;          // sender timestamp (ms)
  confidence: number;         // 0..1
  geo_hint?: TipAdvert["geo_hint"];
  rssi_hint?: TipAdvert["rssi_hint"];
}

export interface WhoHasResult {
  space_id: SpaceId;
  tile_id: TileId;
  peers: TileTipRecord[];     // best-first
}

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function computeConfidence(msg: TipAdvert): number {
  // MVP confidence from signal hints (optional).
  // If no hint, neutral 0.5.
  let c = 0.5;

  if (msg.rssi_hint?.medium === "ble" && typeof msg.rssi_hint.rssi === "number") {
    // typical BLE RSSI ~ -100..-30; map to 0..1
    const r = msg.rssi_hint.rssi;
    c = 0.2 + clamp01((r + 100) / 70) * 0.7;
  } else if (msg.rssi_hint?.medium === "wifi" && typeof msg.rssi_hint.rssi === "number") {
    const r = msg.rssi_hint.rssi;
    c = 0.2 + clamp01((r + 100) / 60) * 0.7;
  } else if (msg.rssi_hint?.medium === "lora" && typeof msg.rssi_hint.snr === "number") {
    // SNR might be ~ -20..+10
    const snr = msg.rssi_hint.snr;
    c = 0.2 + clamp01((snr + 20) / 30) * 0.7;
  }

  // Geo hint can increase confidence slightly
  if (msg.geo_hint?.radius_m != null) {
    const rad = msg.geo_hint.radius_m;
    // smaller radius => better
    const geoBoost = 0.15 * (1 - clamp01(rad / 2000));
    c = clamp01(c + geoBoost);
  }
  return c;
}

function tileKey(space: string, tile: string) {
  return `${space}::${tile}`;
}

export class DiscoveryGraph {
  private opts: Required<DiscoveryOpts>;
  private peers = new Map<PeerId, PeerRecord>();
  private tiles = new Map<string, Map<PeerId, TileTipRecord>>(); // tileKey -> peer->tip
  private persistTimer?: NodeJS.Timeout;

  constructor(opts: DiscoveryOpts = {}) {
    this.opts = {
      persistPath: opts.persistPath ?? "",
      peerTtlMs: opts.peerTtlMs ?? 2 * 60_000,
      tileTtlMs: opts.tileTtlMs ?? 5 * 60_000,
      maxPeers: opts.maxPeers ?? 512,
      maxTiles: opts.maxTiles ?? 4096,
      maxPeersPerTile: opts.maxPeersPerTile ?? 32,
    };

    if (this.opts.persistPath) {
      // best effort load
      void this.load().catch(() => {});
      // periodic save
      this.persistTimer = setInterval(() => void this.save().catch(() => {}), 3000);
    }

    // periodic pruning
    setInterval(() => this.prune(), 2000);
  }

  stop() {
    if (this.persistTimer) clearInterval(this.persistTimer);
  }

  ingestTip(msg: TipAdvert) {
    const now = Date.now();

    // Upsert peer
    const existingPeer = this.peers.get(msg.peer_id);
    const peer: PeerRecord = existingPeer
      ? { ...existingPeer, last_seen: now }
      : { peer_id: msg.peer_id, last_seen: now };

    if (msg.geo_hint) peer.geo_hint = msg.geo_hint;
    if (msg.rssi_hint) peer.rssi_hint = msg.rssi_hint;

    this.peers.set(msg.peer_id, peer);

    // Enforce max peers (simple LRU by last_seen)
    if (this.peers.size > this.opts.maxPeers) this.evictOldestPeers();

    // Upsert tile -> peer tip
    const k = tileKey(msg.space_id, msg.tile_id);
    let perPeer = this.tiles.get(k);
    if (!perPeer) {
      perPeer = new Map();
      this.tiles.set(k, perPeer);
      // Enforce max tiles
      if (this.tiles.size > this.opts.maxTiles) this.evictOldestTiles();
    }

    const prev = perPeer.get(msg.peer_id);
    const conf = computeConfidence(msg);

    // Keep newer sender_ts, or if same, keep lexicographically greater tip_event
    const shouldUpdate =
      !prev ||
      msg.ts > prev.sender_ts ||
      (msg.ts === prev.sender_ts && msg.tip_event.localeCompare(prev.tip_event) > 0);

    if (shouldUpdate) {
      perPeer.set(msg.peer_id, {
        peer_id: msg.peer_id,
        tip_event: msg.tip_event,
        tip_segment: msg.tip_segment,
        last_seen: now,
        sender_ts: msg.ts,
        confidence: conf,
        geo_hint: msg.geo_hint,
        rssi_hint: msg.rssi_hint,
      });
    } else {
      // Still refresh last_seen
      prev.last_seen = now;
      prev.confidence = Math.max(prev.confidence, conf);
      perPeer.set(msg.peer_id, prev);
    }

    // Bound peers per tile (keep best)
    if (perPeer.size > this.opts.maxPeersPerTile) {
      const best = Array.from(perPeer.values())
        .sort((a, b) => scoreTip(b) - scoreTip(a))
        .slice(0, this.opts.maxPeersPerTile);
      perPeer = new Map(best.map((r) => [r.peer_id, r]));
      this.tiles.set(k, perPeer);
    }
  }

  whoHas(space_id: SpaceId, tile_id: TileId): WhoHasResult {
    const k = tileKey(space_id, tile_id);
    const perPeer = this.tiles.get(k);
    const peers = perPeer ? Array.from(perPeer.values()) : [];
    peers.sort((a, b) => scoreTip(b) - scoreTip(a));
    return { space_id, tile_id, peers };
  }

  bestTip(space_id: SpaceId, tile_id: TileId): TileTipRecord | null {
    const res = this.whoHas(space_id, tile_id);
    return res.peers[0] ?? null;
  }

  tilesByPeer(peer_id: PeerId): Array<{ space_id: SpaceId; tile_id: TileId; tip_event: string; tip_segment: string }> {
    const out: Array<{ space_id: SpaceId; tile_id: TileId; tip_event: string; tip_segment: string }> = [];
    for (const [k, perPeer] of this.tiles.entries()) {
      const rec = perPeer.get(peer_id);
      if (!rec) continue;
      const [space_id, tile_id] = k.split("::");
      out.push({ space_id, tile_id, tip_event: rec.tip_event, tip_segment: rec.tip_segment });
    }
    return out;
  }

  peer(peer_id: PeerId): PeerRecord | null {
    return this.peers.get(peer_id) ?? null;
  }

  prune() {
    const now = Date.now();

    // prune peers
    for (const [pid, p] of this.peers.entries()) {
      if (now - p.last_seen > this.opts.peerTtlMs) this.peers.delete(pid);
    }

    // prune tile-peer tips
    for (const [k, perPeer] of this.tiles.entries()) {
      for (const [pid, tip] of perPeer.entries()) {
        if (now - tip.last_seen > this.opts.tileTtlMs) perPeer.delete(pid);
        // if peer gone, drop too
        if (!this.peers.has(pid)) perPeer.delete(pid);
      }
      if (perPeer.size === 0) this.tiles.delete(k);
    }
  }

  private evictOldestPeers() {
    const arr = Array.from(this.peers.values()).sort((a, b) => a.last_seen - b.last_seen);
    const removeCount = Math.max(1, Math.floor(arr.length * 0.1));
    for (let i = 0; i < removeCount; i++) this.peers.delete(arr[i].peer_id);
  }

  private evictOldestTiles() {
    // Evict tiles whose best tip is oldest
    const arr = Array.from(this.tiles.entries()).map(([k, perPeer]) => {
      const best = Array.from(perPeer.values()).sort((a, b) => scoreTip(b) - scoreTip(a))[0];
      const oldest = best ? best.last_seen : 0;
      return { k, oldest };
    }).sort((a, b) => a.oldest - b.oldest);

    const removeCount = Math.max(1, Math.floor(arr.length * 0.1));
    for (let i = 0; i < removeCount; i++) this.tiles.delete(arr[i].k);
  }

  async save() {
    if (!this.opts.persistPath) return;
    const dir = path.dirname(this.opts.persistPath);
    await fs.mkdir(dir, { recursive: true });

    const snapshot = {
      v: 1,
      saved_at: Date.now(),
      peers: Array.from(this.peers.values()),
      tiles: Array.from(this.tiles.entries()).map(([k, perPeer]) => ({
        k,
        tips: Array.from(perPeer.values()),
      })),
    };

    const tmp = this.opts.persistPath + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(snapshot), "utf8");
    await fs.rename(tmp, this.opts.persistPath);
  }

  async load() {
    if (!this.opts.persistPath) return;
    const raw = await fs.readFile(this.opts.persistPath, "utf8");
    const obj = JSON.parse(raw);

    if (obj?.v !== 1) return;

    this.peers = new Map(obj.peers.map((p: PeerRecord) => [p.peer_id, p]));
    this.tiles = new Map(
      obj.tiles.map((t: any) => [t.k, new Map((t.tips as TileTipRecord[]).map((r) => [r.peer_id, r]))])
    );
  }
}

function scoreTip(t: TileTipRecord): number {
  // combine confidence + freshness
  const ageMs = Date.now() - t.last_seen;
  const freshness = Math.max(0, 1 - ageMs / 60_000); // 1 at now, 0 after 60s
  return t.confidence * 0.7 + freshness * 0.3;
}
```

---

# 5) Wire UDP discovery into the graph (host side)

Create a tiny bridge that listens for UDP messages and ingests them.

## `apps/server/src/discovery.ts`

```ts
import { UdpDiscovery } from "@metaverse-kit/tilestore/dist/discovery_udp.js"; // adjust if path differs
import { DiscoveryGraph } from "@metaverse-kit/discovery";
import type { TipAdvert } from "@metaverse-kit/discovery/dist/types.js";      // adjust if path differs

export function startDiscovery(opts: { persistPath?: string; peerId: string }) {
  const graph = new DiscoveryGraph({
    persistPath: opts.persistPath,
    peerTtlMs: 2 * 60_000,
    tileTtlMs: 5 * 60_000,
    maxPeers: 512,
    maxTiles: 4096,
    maxPeersPerTile: 32
  });

  const udp = new UdpDiscovery(48888);

  udp.onMessage((msg: TipAdvert) => {
    // ignore our own echoes if desired
    if (msg.peer_id === opts.peerId) return;
    graph.ingestTip(msg);
  });

  return { graph, udp };
}
```

> If your TS build paths differ, just import directly from source packages in your monorepo (recommended).

---

# 6) Add HTTP endpoints to query discovery

In `apps/server/src/server.ts`, after creating TileStore, start discovery and expose endpoints:

```ts
import { startDiscovery } from "./discovery";

const peerId = "peer:host1";
const { graph } = startDiscovery({ persistPath: "./world/discovery.json", peerId });
```

Add routes:

```ts
// GET /who_has?space_id=demo&tile_id=z0/x0/y0
if (u.pathname === "/who_has" && req.method === "GET") {
  const { space_id, tile_id } = u.query as any;
  if (!space_id || !tile_id) return json(res, { error: "space_id and tile_id required" }, 400);
  return json(res, graph.whoHas(space_id, tile_id));
}

// GET /best_tip?space_id=demo&tile_id=z0/x0/y0
if (u.pathname === "/best_tip" && req.method === "GET") {
  const { space_id, tile_id } = u.query as any;
  if (!space_id || !tile_id) return json(res, { error: "space_id and tile_id required" }, 400);
  return json(res, graph.bestTip(space_id, tile_id) ?? { ok: false });
}

// GET /peer_tiles?peer_id=peer:bob
if (u.pathname === "/peer_tiles" && req.method === "GET") {
  const { peer_id } = u.query as any;
  if (!peer_id) return json(res, { error: "peer_id required" }, 400);
  return json(res, { peer_id, tiles: graph.tilesByPeer(peer_id) });
}
```

Now your host can function as a **broker that knows** without storing other people’s data.

---

# 7) How this matches your philosophy

- **Broker holds only routing knowledge** (tips, peers, hints)
- **No blobs**, no segments copied unless explicitly fetched
- Works with **RSSI / SNR** as relative “geo” signals
- Optional persistence for reboot survival
- Scales down to embedded patterns (bounded tables, TTL pruning)

---

# 8) Next drop-ins (if you want them)

1. **Peer request/response messages**: `who_has`, `i_have`, `request_segments_since`
2. “Fetch from peer” client helper: if broker says Bob has it, client fetches Bob
3. Confidence scoring upgrades:
    - hop count
    - repeated corroboration
    - witness signatures (later)

If you say “yes” again, I’ll drop in (1) + (2): a minimal peer-to-peer fetch protocol on top of HTTP that uses the discovery results.