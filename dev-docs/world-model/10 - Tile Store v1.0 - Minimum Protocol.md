# Tile Store v1 — Minimal Protocol

A tiny, file-first protocol for chunking, syncing, and replaying an infinite canvas.

**Goals**

- Append-only truth
- Chunked by tile
- Content-addressed blobs
- Fast boot via snapshots
- Distributed via simple requests

---

## Core Concepts

- **Tile**: Spatial partition (e.g., `z0/x12/y-3`)
- **Segment**: Immutable chunk of events for a tile
- **Manifest**: Ordered list of segment hashes for a tile
- **Index**: Small pointer file to the current “tip”
- **Snapshot**: Materialized state at a known event
- **Object Store**: Content-addressed blobs (`sha256` or `blake3`)

---

## Storage Layout (suggested)

```
world/
├── objects/sha256/ab/cdef...        # content-addressed blobs
└── spaces/<space_id>/
    └── tiles/<tile_id>/
        ├── index.json
        ├── manifest.json
        └── snapshots/
            └── snap-<event_id>.json
```

---

## 1) Segment Format

A **segment** is an immutable blob containing a list of events.

**File type**: JSON Lines (one event per line)

**Content (example)**:

```json
{"event_id":"evt-901","operation":"create_node", ...}
{"event_id":"evt-902","operation":"update_transform", ...}
```

**Rules**

- Events are ordered by causal order (or timestamp if linear).
- No edits in place.
- Stored as a blob:  
    `segment_hash = sha256(segment_bytes)`

---

## 2) Manifest Format

Lists all segments for a tile, in order.

**File**: `manifest.json`

```json
{
  "tile_id": "z0/x0/y0",
  "segments": [
    {"hash":"sha256:aa11...", "from_event":"evt-800", "to_event":"evt-850"},
    {"hash":"sha256:bb22...", "from_event":"evt-851", "to_event":"evt-900"}
  ]
}
```

**Rules**

- Append-only.
- Order matters.
- Each entry references an immutable segment blob.

---

## 3) Index Format

Fast pointer to “what’s current.”

**File**: `index.json`

```json
{
  "tile_id": "z0/x0/y0",
  "tip_event": "evt-900",
  "tip_segment": "sha256:bb22...",
  "last_snapshot": "sha256:cc33...",
  "snapshot_event": "evt-850",
  "updated_at": 1730000000
}
```

**Rules**

- Small, overwritten in place.
- Used to avoid scanning the manifest on every boot.

---

## 4) Snapshot Format

Materialized shadow state of a tile at a known event.

**File**: `snap-<event_id>.json` (stored as a blob)

```json
{
  "tile_id": "z0/x0/y0",
  "at_event": "evt-850",
  "nodes": [
    {
      "node_id":"node:wall_1",
      "kind":"primitive.rectangle",
      "transform": {...},
      "properties": {...},
      "links":[...]
    }
  ]
}
```

**Rules**

- Represents full tile state at `at_event`.
- Immutable once written.
- Referenced by `index.json`.

---

## 5) Write Path (per tile)

When new events occur:

1. Buffer events in memory.
2. When buffer is “big enough” or time-based:
    - Write a new segment blob.
    - Compute its hash.
3. Append its hash to `manifest.json`.
4. Update `index.json` with new tip.
5. Occasionally:
    - Build snapshot from shadow state.
    - Store snapshot as blob.
    - Update `index.json.last_snapshot`.

---

## 6) Read / Boot Path

To load a tile:

1. Read `index.json`.
2. Fetch `last_snapshot` blob.
3. Apply all segments after `snapshot_event`.
4. Shadow canvas is now current.

---

## 7) Peer Sync Messages

These are logical messages; transport can be HTTP, MQTT, libp2p, etc.

### 7.1 Request Tile Tip

**Request**

```json
{
  "type": "get_tile_tip",
  "space_id": "city_sim",
  "tile_id": "z0/x0/y0"
}
```

**Response**

```json
{
  "tile_id": "z0/x0/y0",
  "tip_event": "evt-900",
  "tip_segment": "sha256:bb22...",
  "last_snapshot": "sha256:cc33...",
  "snapshot_event": "evt-850"
}
```

---

### 7.2 Request Segments Since X

**Request**

```json
{
  "type": "get_segments_since",
  "space_id": "city_sim",
  "tile_id": "z0/x0/y0",
  "after_event": "evt-850"
}
```

**Response**

```json
{
  "tile_id": "z0/x0/y0",
  "segments": [
    {"hash":"sha256:bb22...", "from_event":"evt-851", "to_event":"evt-900"}
  ]
}
```

Client then fetches each segment blob by hash.

---

### 7.3 Request Snapshot

**Request**

```json
{
  "type": "get_snapshot",
  "hash": "sha256:cc33..."
}
```

**Response**

```json
{
  "hash": "sha256:cc33...",
  "content": { ... snapshot json ... }
}
```

---

### 7.4 Request Object (generic blob)

**Request**

```json
{
  "type": "get_object",
  "hash": "sha256:bb22..."
}
```

**Response**

```json
{
  "hash": "sha256:bb22...",
  "bytes": "<raw or base64>"
}
```

---

## 8) Consistency Rules

- Segments and snapshots are immutable.
- Only `index.json` and `manifest.json` are mutable.
- Clients must verify content hashes.
- Replay order = snapshot → segments in manifest order.

---

## 9) What This Gives You

- Infinite canvas, chunked by tile
- Replayable history
- Fast startup via snapshots
- Distributed sync without central cache
- Git/IPFS-like integrity with simple files

**In one sentence:**

> Tile Store v1 is “Git for space-time,” with tiles as branches, segments as commits, and snapshots as fast checkouts.