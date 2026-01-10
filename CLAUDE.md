# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Metaverse Starter Kit** is a distributed, local-first collaborative infinite canvas system built on append-only event traces. The system enables multi-user editing with deterministic replay, supporting projections into 2D, 3D, AR, and VR from the same event stream. It's designed to work offline, synchronize opportunistically, and scale down to embedded devices (ESP32) while scaling up to full metaverse applications.

### Core Philosophy

- **Truth is append-only**: Reality is an event ledger. Nothing is overwritten—only added.
- **State is derived**: Current state is computed from history via shadow canvases and snapshots.
- **Projection over production**: Media/views are projected from events, not authored separately.
- **Local-first**: Everything works offline and synchronizes opportunistically.
- **Fail-fast scope**: Boundaries and authority are explicit and enforced early via dotfiles.
- **Deterministic replay**: Replay must always converge to the same state.

## Architecture Components

### Three Execution Classes

The system distinguishes between three runtime environments:

1. **Host runtime** (Node/Deno/Bun/serverless): Runs Tile Store, manages segments/manifests/snapshots, enforces scope and invariants
2. **Worker runtime** (WASM-based): Runs projectors (2D/3D/physics/audio), sandboxed and deterministic
3. **Client runtime** (browser/desktop/mobile/VR): UI, gestures, cursors, event creation, shadow canvas

### Three Graphs

- **Event Graph**: Ground truth—append-only event DAG
- **Discovery Graph**: Who knows what, where (routing knowledge, not data)
- **Projection Graph**: Views of reality (2D, 3D, AR, VR, maps, audio)

### Event Processing Pipeline

```
Events (JSONL) → Validate (Scope + NF) → Store (TileStore) → Materialize (Shadow Canvas) → Project (Views)
```

## Repository Structure

```
metaverse-kit/
├── apps/
│   ├── server/                 # Sync + Tile Store API (HTTP/WebSocket)
│   └── client/                 # Web client: 2D canvas + timeline
├── packages/
│   ├── protocol/               # Types + validators + codecs
│   ├── shadow-canvas/          # Materializer (apply events → state)
│   ├── tilestore/              # Segment/manifest/index/snapshot logic
│   ├── addr/                   # ADDR.v1 addressing implementation
│   ├── nf/                     # NF.v1 normalization + equivalence
│   ├── pf16/                   # PF16.v1 typed identity + composition
│   ├── projector-2d/           # 2D renderer
│   ├── projector-3d/           # 3D renderer
│   └── physics/                # Deterministic stepper (v2)
├── tools/
│   ├── mv-init                 # CLI: create world
│   ├── mv-host                 # CLI: run server
│   ├── mv-client               # CLI: open client
│   ├── mv-replay               # CLI: extract event ranges
│   └── mv-view                 # CLI: run projectors
├── world-format/
│   ├── .ulp-root               # Global invariants + defaults
│   ├── .ulp-ignore             # Non-existent paths (gitignore syntax)
│   └── .ulp-scope              # Local scope overrides
└── dev-docs/                   # Architecture documentation
```

## Core Protocols

### World Event Protocol (JSONL)

All events share this envelope:

```json
{
  "event_id": "evt-uuid",
  "timestamp": 1730000000,
  "space_id": "demo",
  "layer_id": "layout|physics|presentation|meta",
  "actor_id": "user:alice|solver:phys_v1",
  "operation": "create_node|update_transform|set_properties|link_nodes|...",
  "scope": {"realm":"team","authority":"source","boundary":"interior"},
  "preserves_invariants": ["adjacency","exclusion","consistency","boundary_discipline","authority_nontransfer"],
  "previous_events": ["evt-parent-1"],
  "tile": "z0/x0/y0"
}
```

**Required operations (v0)**: create_node, update_transform, set_properties, link_nodes, unlink_nodes, delete_node, merge

**Optional (v1)**: set_geometry, set_media, macro.*

**Optional (v2)**: set_physics, physics_step

### Tile Store v1 (Chunking Protocol)

World is partitioned into spatial tiles with content-addressed blobs:

- **Segment**: Immutable JSONL blob of events, hash = sha256(bytes)
- **Manifest** (`manifest.json`): Ordered list of segment hashes with event ranges
- **Index** (`index.json`): Fast pointer to current tip + last snapshot
- **Snapshot**: Materialized state at a known event
- **Object Store**: Content-addressed blobs at `objects/sha256/ab/cdef...`

Storage layout:
```
world/
├── objects/sha256/...          # Content-addressed blobs
└── spaces/<space_id>/
    └── tiles/<tile_id>/
        ├── index.json
        ├── manifest.json
        └── snapshots/
```

### Shadow Canvas

Deterministic materializer: `snapshot + segments → current state`

- Nodes keyed by node_id
- Links use OR-Set semantics
- Properties use LWW (Last-Write-Wins) per key
- Transforms use LWW with timestamp + event_id tiebreaker
- delete_node creates tombstone (preserves history)

### Fail-Fast Scope System

**Dotfiles** (resolution order):
1. `.ulp-ignore`: Excluded paths = non-existent (gitignore syntax)
2. `.ulp-root`: Global invariants + default scope (YAML)
3. `.ulp-scope`: Local overrides (YAML)

**Scope fields**:
- realm: personal|team|public
- authority: source|derived
- boundary: interior|boundary|exterior
- policy: public|private|redacted

Events must declare `preserves_invariants` matching `.ulp-root` invariants or they're rejected.

### Projector Model (stdin/stdout/stderr)

A projector is a process that:
- Reads events (JSONL) on **stdin**
- Writes projected output on **stdout**
- Writes boundary/witness logs on **stderr**

Examples:
```sh
cat trace.jsonl | projector-2d > view2d.jsonl 2> boundary.log
cat trace.jsonl | physics-step > physics.jsonl 2> warnings.log
```

Projectors must be deterministic and never mutate truth. Derived events must be scoped as `authority: derived`.

## Addressing and Identity

### Three Identity Mechanisms

- **Content Hash** (RID): Immutable identity of _what_ (sha256 or blake3 of blob data)
- **HD Path** (SID): Structural identity of _where_ (BIP32-like: `m/world/demo/tiles/z0/x0/y0/head`)
- **Key-based** (Actor ID): Identity of _who_ (Ethereum-style or ed25519 public key)

Never confuse these three. HD paths point to content hashes; they don't replace them.

### ADDR.v1

Immutable content IDs (RID) + mutable structural pointers (SID via HD paths). Content-addressed objects ensure integrity and deduplication. Structural paths enable navigation and "current state" pointers.

### NF.v1 (Normal Form)

Determines equivalence of constraint blocks under allowed transformations. Ensures the same underlying constraint yields the same public identifier, making addressing idempotent and transformations auditable.

### PF16.v1

Typed 16-slot identity composition for managing complex identity relationships in federated scenarios.

## Hardware Integration

System scales down to **ESP32** nodes for:
- Sensor reading/event emission
- Discovery brokering
- Data ferrying in mesh networks

**Network stack**:
- LoRa: Long-range discovery
- WiFi: Data transfer
- BLE: Presence & intent

Designed for disaster response and community coordination when internet is unavailable.

## Development Workflow

### Tool Philosophy

Prefer specialized tools over bash:
- **Read** for reading files (not cat/head/tail)
- **Edit** for editing (not sed/awk)
- **Write** for creating files (not echo/heredoc)
- **Grep** for content search (not grep/rg commands)
- **Glob** for file patterns (not find/ls)

Use bash only for actual terminal operations (git, npm, docker, etc.).

### File Operations

Events are stored as JSONL (one event per line). Use awk-style filtering on host side, not client side. Client talks to host for filtered streams.

When working with JSONL:
- Validate structure before writing
- Preserve deterministic ordering
- Maintain content hash integrity
- Never mutate immutable segments

### Data Processing Pipeline

Think in terms of pipes:
```
trace.jsonl → filter (awk/scope) → projector (WASM) → view
```

Scope enforcement happens before projection. Discovery routes knowledge of data, not data itself.

## Implementation Phases

- **v0 (MVP)**: Infinite 2D canvas, events, tiles, replay, multi-user cursors
- **v1**: 3D projection, layers, media references, snapshots
- **v2**: Deterministic physics, sensor integration
- **v3**: AR/VR support
- **v4**: Peer-to-peer discovery via DHT/gossip

## Key Invariants to Preserve

When modifying code, always maintain:

1. **Append-only semantics**: Never overwrite history
2. **Content addressability**: Immutable blobs must hash correctly
3. **Deterministic replay**: Same events → same state
4. **Scope enforcement**: Validate against dotfiles before storage
5. **Causal ordering**: Respect DAG structure in event processing
6. **Boundary discipline**: Keep authority roles (source vs derived) distinct

## Security Model

**v0** (pragmatic):
- actor_id required but unsigned
- Server enforces realm permissions (basic auth or token)
- Private witness streams stored only under private scopes

**v1**:
- Signed events (ed25519) optional
- Federation scopes define who can produce `authority: source` events
- Content hashes always verified on fetch

## Common Patterns

### Creating Events

Always include: event_id (ULID), timestamp, space_id, layer_id, actor_id, operation, scope, preserves_invariants, previous_events, tile

### Processing Events

1. Load snapshot (if available)
2. Apply events after snapshot in causal order
3. Use timestamp + event_id for LWW tiebreaking
4. Build shadow canvas deterministically

### Syncing Tiles

1. Request tile tip (get tip_event, tip_segment, last_snapshot)
2. Fetch snapshot
3. Request segments since snapshot_event
4. Apply incrementally

## References

Key documentation in `dev-docs/`:
- `09 - Metaverse Starter Kit.md`: Full implementation specification
- `10 - Tile Store v1.0 - Minimum Protocol.md`: Storage protocol details
- `11 - World Model.md`: Architecture philosophy and data flow
- `01 - Three execution classes.md`: Runtime environments and roles
- `04 - Community Metaverse Protocol.md`: White paper on trace-based reality
- `1002 - IMPLEMENTATION_GUIDE.md`: NF.v1 + ADDR.v1 + PF16.v1 implementation

## Design Principles

- **Human-first**: Use long, explicit field names. Readability over brevity.
- **Fail-fast**: Validate early at scope boundaries, not deep in processing.
- **POSIX-native**: Leverage standard tools (awk, pipes, content addressing).
- **No over-engineering**: Avoid abstractions for one-time operations. Three similar lines beat premature abstraction.
- **Local-first always**: Every feature must work offline and sync opportunistically.

## Final Guiding Rule

> If it can't be replayed, it isn't real.
> If it can't be shared locally, it isn't resilient.
> If it can't be projected many ways, it isn't truth—just a picture.
