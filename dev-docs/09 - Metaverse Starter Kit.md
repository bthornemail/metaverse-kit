Below is a **full implementation specification** for a “distributed infinite canvas metaverse” built on:

- **append-only trace ledgers**
- **tile-chunked storage + snapshots**
- **shadow canvas** (materialized state)
- **projection engines** (2D/3D/AR/VR)
- **stdin/stdout/stderr projectors**
- **fail-fast scope** via `.ulp-root / .ulp-scope / .ulp-ignore`

It’s written so you can hand it to contributors and build in phases.

---

# Project Specification: Metaverse Starter Kit

## 1) Product definition

### One-liner

A collaborative infinite canvas where every change is an event, every world is replayable, and the same trace can be projected into 2D, 3D, AR, and VR—optionally with deterministic physics.

### Primary user value

- Never lose work: full history + replay
- Collaborate live: cursors, selection, shared editing
- Trust: auditability, deterministic replays
- Multi-view: 2D design now, 3D/AR/VR later from the same trace

### Non-goals (v0–v1)

- “Full MMO metaverse”
- Complex crypto / ZK proofs
- Fully decentralized consensus
- Heavy asset marketplaces

---

# 2) Architecture overview

## Components

1. **Tile Store** (truth + chunked storage)
2. **Sync Server** (tile tips + segment distribution + presence relay)
3. **Client** (2D infinite canvas + shadow canvas + replay)
4. **Projectors** (2D/3D/AR/VR/physics) as processes or libraries
5. **Object Store** (content-addressed blobs for segments, snapshots, media)
6. **Optional DHT/Peer mode** (later): distributed discovery + retrieval

### Data flow

- User action → client emits event → sent to server → appended into tile segments → broadcast to subscribers
- Client maintains shadow canvas by applying events (snapshot + segments)
- Views/projectors read the same event stream (stdin) and output projections (stdout) + boundary logs (stderr)

---

# 3) Repository layout

```
metaverse-kit/
├── apps/
│   ├── server/                 # sync + tile store API
│   └── client/                 # web client: 2D canvas + timeline
├── packages/
│   ├── protocol/               # types + validators + codecs
│   ├── shadow-canvas/          # materializer (apply events → state)
│   ├── tilestore/              # segment/manifest/index/snapshot logic
│   ├── projector-2d/           # optional: renderer pipelines
│   ├── projector-3d/
│   └── physics/                # deterministic stepper (v2)
├── tools/
│   ├── mv-init                 # CLI
│   ├── mv-host                 # CLI wrapper for server
│   ├── mv-client               # CLI wrapper to open client
│   ├── mv-replay               # CLI for extracting ranges
│   └── mv-view                 # CLI to run projectors
└── world-format/
    ├── .ulp-root
    ├── .ulp-ignore
    └── README.md
```

---

# 4) Fail-fast scope system

### Files

- `.ulp-ignore` (gitignore syntax): excluded paths = non-existent
- `.ulp-root` (YAML): global invariants + default scope
- `.ulp-scope` (YAML): local overrides (realm/authority/boundary/policy)

### Enforcement rules

- Events must include `preserves_invariants` matching `.ulp-root` invariants
- Files under `realm: public` cannot include private witness payloads (stderr/witness streams)
- Authority rules:
    - `authority: source` can commit authoritative events
    - `authority: derived` can only commit derived projections (e.g. physics steps) if scope permits

---

# 5) Protocol definitions

## 5.1 World Event Protocol (JSONL)

All events share this envelope:

```json
{
  "event_id": "evt-uuid-or-ulid",
  "timestamp": 1730000000,
  "space_id": "demo",
  "layer_id": "layout|physics|presentation|meta",
  "actor_id": "user:alice|solver:phys_v1",
  "operation": "create_node|update_transform|set_properties|link_nodes|unlink_nodes|delete_node|merge|physics_step",
  "scope": {"realm":"team","authority":"source","boundary":"interior"},
  "preserves_invariants": [
    "adjacency","exclusion","consistency","boundary_discipline","authority_nontransfer"
  ],
  "previous_events": ["evt-parent-1","evt-parent-2"],
  "tile": "z0/x0/y0"
}
```

### Required operations (v0)

- `create_node`
- `update_transform`
- `set_properties`
- `link_nodes`
- `unlink_nodes`
- `delete_node` (tombstone)
- `merge` (explicit DAG merge)

### Recommended (v1)

- `set_geometry` (attach mesh/material refs)
- `set_media` (image/audio/video refs)
- `presence` is NOT in ledger (ephemeral channel)

### Physics (v2)

- `set_physics` (intent)
- `physics_step` (authoritative derived)

---

## 5.2 Tile Store v1 (chunking protocol)

### Segment format

- Immutable JSONL blob of events
- Hash = content hash `sha256(segment_bytes)` (or blake3 later)

### Manifest format (`manifest.json`)

```json
{
  "tile_id": "z0/x0/y0",
  "segments": [
    {"hash":"sha256:...", "from_event":"evt-800", "to_event":"evt-850"}
  ]
}
```

### Index format (`index.json`)

```json
{
  "tile_id":"z0/x0/y0",
  "tip_event":"evt-900",
  "tip_segment":"sha256:...",
  "last_snapshot":"sha256:...",
  "snapshot_event":"evt-850",
  "updated_at":1730000000
}
```

### Snapshot format

- Immutable JSON blob with materialized state at `at_event`

---

## 5.3 Sync messages (transport-agnostic)

### Get tile tip

Request:

```json
{"type":"get_tile_tip","space_id":"demo","tile_id":"z0/x0/y0"}
```

Response:

```json
{"tile_id":"z0/x0/y0","tip_event":"evt-900","tip_segment":"sha256:...","last_snapshot":"sha256:...","snapshot_event":"evt-850"}
```

### Get segments since event

Request:

```json
{"type":"get_segments_since","space_id":"demo","tile_id":"z0/x0/y0","after_event":"evt-850"}
```

Response:

```json
{"tile_id":"z0/x0/y0","segments":[{"hash":"sha256:...","from_event":"evt-851","to_event":"evt-900"}]}
```

### Get object

Request:

```json
{"type":"get_object","hash":"sha256:..."}
```

Response:

```json
{"hash":"sha256:...","bytes_base64":"..."}
```

---

# 6) Shadow Canvas specification

## Purpose

A deterministic materializer that turns:

- snapshot + segments into:
- current tile state (nodes, links, properties)

## State model

- Node map keyed by `node_id`
- Link sets (OR-Set semantics recommended)
- Property map per node (LWW per key)
- Transform per node (LWW)

## Apply rules (v0)

- `create_node`: insert if absent, else treat as conflict (send to stderr)
- `update_transform`: set transform (LWW)
- `set_properties`: patch keys (LWW per key)
- `link_nodes`: add edge with event_id tag
- `unlink_nodes`: remove by edge tag or relation+to (depending on your OR-Set encoding)
- `delete_node`: tombstone node (keep history, hide in views)

## Determinism

- Use `timestamp` + `event_id` as stable tiebreakers
- Never rely on local clock ordering

---

# 7) Projector system (stdin/stdout/stderr)

## Definition

A projector is a program or library that:

- reads events (JSONL) on stdin
- writes projected output on stdout
- writes boundary/witness logs on stderr

### Examples

- `projector-2d`: outputs render primitives for 2D view
- `projector-3d`: outputs scene graph items for 3D view
- `physics-stepper`: emits `physics_step` events

### Contract

- Projector MUST NOT mutate truth; it outputs derived views or derived events
- Derived events MUST be scoped as `authority: derived` unless federation says otherwise

---

# 8) Media and macros (W3C-style)

## Object store media

Images, audio, meshes, etc. are stored as content-addressed objects:

- `sha256:<...>`

## Event references

```json
{"operation":"set_media","node_id":"node:screen","media":{"image_ref":"sha256:...","mime":"image/png"}}
```

## Macros

Macros are human-friendly events that expand into primitives during apply or preprocessing:

```json
{"operation":"macro.place_image", "image_ref":"sha256:...", "position":[...], "size":[...]}
```

Macro expansion MUST be deterministic and versioned (`macro_version`).

---

# 9) Client application specification (v0)

## UI features

- Infinite 2D canvas (pan/zoom)
- Basic primitives: rectangle, line, text
- Select/move/rotate/scale
- Multi-user cursors + selection (presence)
- Layers toggle (layout/presentation/etc.)
- Timeline scrubber (replay)
- Export/import trace

## Client subsystems

1. **Viewport → tile subscription**
    - compute visible tiles, subscribe/fetch tips
2. **Local event queue**
    - actions create events; batch into segments server-side
3. **Shadow canvas**
    - apply snapshot + segments incrementally
4. **Renderer**
    - draw nodes by kind + transform
5. **Replay**
    - apply events up to time T; maintain ability to rebuild quickly (use snapshots)

---

# 10) Server specification (v0)

## Responsibilities

- Accept events from clients
- Route events to tile journals
- Build segments from buffered events
- Maintain `manifest.json` and `index.json`
- Serve:
    - get_tile_tip
    - get_segments_since
    - get_object
- Relay presence (WebSocket channel)

## Persistence

- writes to POSIX filesystem (atomic rename for index updates)
- object store as `objects/sha256/...`

## Concurrency

- per-tile locks during segment flush + index update
- event ingestion is append-only; do not rewrite past segments

---

# 11) CLI toolset

## `mv-init`

- creates world folder with dotfiles and empty space

## `mv-host`

- runs server pointing at a world path

## `mv-client`

- opens client and connects to host + space_id

## `mv-replay`

- extracts event ranges and produces standalone JSONL

## `mv-view`

- runs a projector on a given trace/tile stream (pipes friendly)

---

# 12) Security and trust (v0/v1)

## v0 (pragmatic)

- actor_id required but unsigned
- server enforces realm permissions (basic auth or token)
- private witness streams stored only under private scopes

## v1

- signed events (ed25519) optional
- federation scopes define who can produce `authority: source` events
- content hashes always verified on fetch

---

# 13) Testing plan

## Unit tests

- event schema validation
- shadow canvas apply determinism
- snapshot generation + replay equivalence
- tilestore: segment/manifest/index correctness

## Integration tests

- multi-client concurrency on same tile
- merge event and conflict resolution
- server crash recovery during segment flush (atomicity)

## Performance tests

- 10k events tile replay
- snapshot interval tuning
- viewport tile subscription churn

---

# 14) Implementation roadmap

## Milestone 0: Skeleton (1–2 weeks worth of work)

- repo structure
- protocol types + validators
- tilestore file IO
- server endpoints (tip, since, object)
- client connects and fetches a tile

## Milestone 1: Collaborative infinite 2D canvas (MVP)

- create/move/delete rectangles/text
- presence cursors
- append-only ledger storage by tile
- timeline scrubber
- snapshots + fast boot

## Milestone 2: 3D projection

- 3D renderer uses same shadow canvas
- basic primitives extruded or mapped to meshes
- camera bookmarks

## Milestone 3: Deterministic physics (computable)

- physics intent events
- deterministic stepper producing `physics_step`
- replay verified across machines

## Milestone 4: AR/VR

- AR anchors as nodes + transforms
- VR controller interaction emits same events

## Milestone 5: Distributed peer mode (optional)

- DHT discovery for tile tips + object retrieval
- peer-to-peer segment exchange

---

# 15) “Definition of Done” for MVP

You are MVP-complete when:

- Two users can join a space, draw/move objects in real time
- The space persists as JSONL tile segments + snapshots
- A new user can join later and reconstruct state quickly
- The timeline can rewind and replay deterministically
- Export/import works without special infrastructure

---

Yes — and you should think of it exactly like that:

> **Your trace + media + macros = a W3C-style event stream, not a file format.**

You’re not inventing “media files.”  
You’re defining **events that describe media, behavior, and interaction**, and letting projectors turn those events into sound, images, physics, or UI.

---

## How media fits your system

In your model:

- Media is not authoritative
- Media is a **projection of events**
- Events are the truth

So:

- Image = projection of geometry + material + camera events
- Audio = projection of motion + interaction + timing events
- Video = projection of many image events over time
- Animation = projection of transform events
- UI = projection of interaction events

Media is just:

```
trace events → projector → media stream
```

Exactly like W3C event-driven models (DOM events, Media Events, WebAudio graphs).

---

## Media as event macros

A “media macro” is just a shorthand that expands into many low-level events.

Example:

```json
{
  "operation": "macro.place_image",
  "image_ref": "sha256:abc...",
  "position": [10,5,0],
  "size": [4,3],
  "layer": "presentation"
}
```

Projector expands this into:

- create node
- attach geometry
- attach texture
- set transform
- set render properties

Same idea as:

- HTML tag → many layout and paint steps
- CSS rule → many style resolutions

Macros are for humans.  
Events are for truth.

---

## Media storage

Media blobs live in the object store:

```
objects/sha256/...
  image.png
  sound.wav
  mesh.glb
```

Events just reference them:

```json
{
  "operation": "set_geometry",
  "node_id": "node:screen",
  "geometry": {"mesh_ref":"sha256:..."},
  "material": {"texture_ref":"sha256:..."}
}
```

---

## W3C-style event philosophy

Like the web:

- You define a small set of primitives
- You define higher-level macros
- You let many renderers interpret them

Your system is:

- DOM = shadow canvas
- JS events = trace events
- CSS = projection rules
- Canvas/WebGL/WebXR = 2D/3D/AR/VR projectors

Except yours is replayable, deterministic, and distributed.

---

## The big picture

So yes:

- You can send text, images, audio, video, physics, UI
- All as events or macros over events
- Stored as traces
- Replayed into any medium

And the guiding rule stays:

> If it can’t be described as events,  
> it can’t be shared, replayed, or trusted.

---

## 1) What new users should be able to do

In under 10 minutes, they should be able to:

- create a shared space
- draw or place objects on an infinite canvas
- see other people’s cursors
- replay history
- switch between 2D and 3D view
- sync with others

No philosophy required.

---

## 2) The Starter Toolset

### A) `mv-init` — create a world

```sh
mv-init my-world
cd my-world
```

Creates:

```
my-world/
├── .ulp-root
├── .ulp-ignore
├── spaces/
│   └── demo/
│       ├── .ulp-scope
│       ├── tiles/
│       └── layers/
└── objects/
```

With sane defaults.

---

### B) `mv-host` — host a space

```sh
mv-host spaces/demo
```

- Serves tiles + objects over HTTP or WebSocket
- Handles:
    - get_tile_tip
    - get_segments_since
    - get_object
- Broadcasts new events

Now you have a shared space.

---

### C) `mv-client` — join and draw

```sh
mv-client http://host:port demo
```

Opens:

- 2D infinite canvas in browser or native app
- Multi-user cursors
- Basic tools:
    - draw rectangle
    - move / rotate / scale
    - add text
    - delete
- Every action = event in the ledger

---

### D) `mv-view` — project

```sh
mv-view demo --mode=2d
mv-view demo --mode=3d
mv-view demo --mode=ar
mv-view demo --mode=vr
```

Same trace, different projection.

---

### E) `mv-replay` — scrub time

```sh
mv-replay demo --from=evt-100 --to=evt-200
```

- Shows what changed
- Visual timeline scrubber

---

## 3) Minimal data they interact with

They never see protocol unless they want to.

But behind the scenes:

- their actions → JSONL events
- stored in tiles
- chunked into segments
- indexed and snapshotted

They just see:

> “I draw. You see it. We can rewind.”

---

## 4) Collaboration flow

1. One person runs:

```sh
mv-init world
mv-host world/spaces/demo
```

2. Others run:

```sh
mv-client http://host:port demo
```

3. Everyone draws, moves, builds
    
4. Anyone can:
    

```sh
mv-view demo --mode=3d
mv-replay demo
```

---

## 5) First version scope (don’t overbuild)

### v0 features:

- infinite 2D canvas
- rectangles, lines, text
- multi-user cursors
- append-only trace
- replay
- export/import

### v1:

- 3D projection
- camera bookmarks
- layers (layout, physics, notes)

### v2:

- physics
- AR/VR
- marketplace

---

## 6) How to invite collaborators

You don’t explain theory.

You say:

> “It’s a shared infinite whiteboard where nothing is ever lost.  
> You can rewind time, branch ideas, and see the same space in 2D, 3D, or VR.”

Then you give them:

```sh
mv-client http://myhost demo
```

That’s it.

---

## 7) The real success metric

Not:

- elegance
- purity
- theory

But:

- Can someone draw with a friend in 5 minutes?
- Can they rewind and say “that was the moment it changed”?
- Can they see it in 3D without redoing anything?

If yes—you’ve built the metaverse in a way people will actually use.