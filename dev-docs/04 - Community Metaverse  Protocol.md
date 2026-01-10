# Community Metaverse Protocol

### A White Paper on Trace-Based Reality, Local-First Coordination, and Distributed Discovery

**Version:** 1.0  
**Author:** Community Metaverse Initiative  
**Status:** Draft for Implementation

---

## Abstract

This paper presents a new architecture for shared digital and physical reality based on **append-only traces**, **local-first storage**, and **distributed discovery**. The system enables collaborative infinite canvases, metaverse environments, and real-world coordination (including disaster response) without relying on centralized servers or continuous internet access.

Reality is modeled as a stream of events. Views—2D, 3D, AR, VR, maps, audio, or dashboards—are deterministic projections of those events. Storage is chunked by spatial tiles, content-addressed for integrity, and synchronized opportunistically. Discovery is handled by a lightweight gossip graph that routes _knowledge of data_, not the data itself—making the system small enough to run on ESP32, LoRa, WiFi, and BLE mesh networks.

---

## 1. Motivation

Modern collaboration systems suffer from:

- Centralized control
- Lossy history
- No deterministic replay
- Fragility during outages
- Poor integration with physical reality

We propose:

> A world where every change is recorded,  
> every state is derived,  
> every view is a projection,  
> and every community can host its own reality.

---

## 2. Core Principles

1. **Append-Only Truth**  
    Reality is an event ledger. Nothing is overwritten—only added.
    
2. **Derived State**  
    “Current state” is computed from history (via shadow canvases and snapshots).
    
3. **Projection over Production**  
    Media is not authored—it is projected from events.
    
4. **Local-First**  
    Everything works offline and synchronizes opportunistically.
    
5. **Determinism**  
    Replay must always converge.
    
6. **Fail-Fast Scope**  
    Boundaries and authority are explicit and enforced early.
    
7. **Discovery ≠ Storage**  
    Knowing _where_ data is does not mean _having_ the data.
    

---

## 3. Conceptual Architecture

### 3.1 Three Graphs

|Graph|Purpose|
|---|---|
|Event Graph|Ground truth: append-only event DAG|
|Discovery Graph|Who knows what, where|
|Projection Graph|Views of reality (2D, 3D, AR, VR, maps, audio)|

### 3.2 Event-First Model

Everything is an event:

- Drawing a shape
- Moving a person
- Sensor reading
- Team intent
- Physics update
- Media reference

Events are small, structured JSON lines.

---

## 4. World Event Protocol

### 4.1 Canonical Event Envelope

```json
{
  "event_id": "evt-001",
  "timestamp": 1730000000,
  "space_id": "demo",
  "layer_id": "layout",
  "actor_id": "user:alice",
  "operation": "create_node",
  "scope": {
    "realm": "team",
    "authority": "source",
    "boundary": "interior",
    "policy": "public"
  },
  "preserves_invariants": [
    "adjacency",
    "exclusion",
    "consistency",
    "boundary_discipline",
    "authority_nontransfer"
  ],
  "previous_events": [],
  "tile": "z0/x0/y0"
}
```

### 4.2 Core Operations

- create_node
- update_transform
- set_properties
- link_nodes / unlink_nodes
- delete_node
- merge
- set_media / set_geometry
- set_physics / physics_step
- macro.* (deterministic expansion)

---

## 5. Fail-Fast Scope System

### 5.1 Dotfiles

|File|Role|
|---|---|
|.ulp-ignore|Defines non-existent paths|
|.ulp-root|Global invariants + defaults|
|.ulp-scope|Local overrides|

### 5.2 Scope Fields

- realm: personal | team | public
- authority: source | derived
- boundary: interior | boundary | exterior
- policy: public | private | redacted

Events that violate scope are rejected before storage.

---

## 6. Tile Store v1

### 6.1 Chunking by Space

World is partitioned into spatial tiles:

```
space/
  tiles/z0/x0/y0/
    index.json
    manifest.json
    snapshots/
```

### 6.2 Content Addressing

All immutable blobs are stored as:

```
objects/sha256/ab/cdef...
```

Used for:

- Event segments
- Snapshots
- Media
- Meshes

### 6.3 Files

**Segment (immutable JSONL):**

- Ordered events for a tile
- Hash = content hash

**Manifest (append-only):**

```json
{
  "tile_id":"z0/x0/y0",
  "segments":[{"hash":"sha256:...","from_event":"evt-1","to_event":"evt-50"}]
}
```

**Index (mutable pointer):**

```json
{
  "tile_id":"z0/x0/y0",
  "tip_event":"evt-50",
  "tip_segment":"sha256:...",
  "last_snapshot":"sha256:...",
  "snapshot_event":"evt-30"
}
```

**Snapshot (immutable):**

- Materialized tile state at event X

---

## 7. Shadow Canvas

A deterministic materializer:

```
snapshot + segments → current state
```

Rules:

- Events ordered by:
    1. DAG order
    2. timestamp
    3. event_id
- LWW per transform and property
- OR-Set for links
- delete_node = tombstone

---

## 8. Projector Model

A projector is just a process:

```
stdin  = events
stdout = projected view
stderr = boundary/witness log
```

Examples:

- 2D renderer
- 3D renderer
- AR overlay
- Physics solver
- Audio generator

Pipelines:

```sh
cat trace.jsonl | projector-3d > scene.jsonl 2> boundary.log
```

---

## 9. Media as Projection

Media is never authoritative.

Images, audio, meshes are:

- stored as content-addressed blobs
- referenced by events
- projected into views

Macros expand into primitives.

---

## 10. Discovery Graph

### 10.1 Purpose

Not to store data—but to route knowledge of data.

Tracks:

- Peer → Tile
- Tile → Segment
- Path → Content Hash

### 10.2 Gossip

Peers advertise:

```json
{
  "peer":"peer:alice",
  "knows":[
    {"path":"m/world/demo/tiles/z0/x0/y0/head","points_to":"sha256:..."}
  ]
}
```

### 10.3 Demand Routing

If you need X and Bob says he has it:

```
ask Bob directly
```

No DHT required initially.

---

## 11. HD Path Addressing

Use BIP32-like paths for naming:

```
m/world/demo/tiles/z0/x0/y0/head
```

Roles:

|Mechanism|Identity Of|
|---|---|
|Content Hash|What|
|HD Path|Where|
|Key/Wallet|Who|

---

## 12. Hardware Integration

### 12.1 ESP32 Nodes

ESP32 can act as:

- Sensor node
- Event emitter
- Discovery broker
- Data ferry

Sensor event:

```json
{
  "operation":"sensor_reading",
  "sensor":"water_level",
  "value":1.42,
  "tile":"z0/x12/y7",
  "actor_id":"node:esp32_A12"
}
```

### 12.2 Network Stack

|Layer|Role|
|---|---|
|LoRa|Long-range discovery|
|WiFi|Data transfer|
|BLE|Presence & intent|

---

## 13. Disaster & Community Mode

Works when internet is gone:

- LoRa gossips discovery
- WiFi moves data opportunistically
- Phones act as ferries
- Snapshots enable fast boot

Use cases:

- Flood tracking
- Fire mapping
- Search & rescue
- Resource coordination
- Community archives

---

## 14. Security Model

### v0

- Actor IDs unsigned
- Server/local scope enforcement
- Content hash verification

### v1

- Signed events (ed25519)
- Federation rules for authority
- Private witness streams

---

## 15. Implementation Phases

|Phase|Features|
|---|---|
|v0|Infinite 2D canvas, events, tiles, replay|
|v1|3D view, layers, media|
|v2|Physics, sensors|
|v3|AR/VR|
|v4|Peer-to-peer discovery|

---

## 16. What This Creates

Not just a metaverse:

- A replayable reality engine
- A community-owned digital infrastructure
- A disaster-resilient coordination layer
- A bridge between physical and digital worlds

---

## 17. Final Principle

> If it can’t be replayed,  
> it isn’t real.

> If it can’t be shared locally,  
> it isn’t resilient.

> If it can’t be projected many ways,  
> it isn’t truth—just a picture.