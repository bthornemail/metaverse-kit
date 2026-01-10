# Implementation Plan: Metaverse Starter Kit (v0 MVP + partial v1)

## Overview

Implement a distributed, local-first collaborative infinite canvas metaverse from specification. Target: Full v0 MVP (2D infinite canvas, multi-user events, replay) + partial v1 (3D projection capability).

**Current State:** Green-field project with comprehensive documentation (16 markdown files, ~225KB) but zero source code.

**Tech Stack:** TypeScript + Node.js, React + Canvas API, npm + Vite monorepo

**Timeline Estimate:** 6-8 weeks for full implementation

## Architecture Summary

- **Event-first:** Append-only JSONL trace is truth
- **Tile-chunked storage:** Spatial partitioning with content-addressed blobs
- **Shadow canvas:** Deterministic materializer (snapshot + segments → state)
- **Projectors:** stdin/stdout/stderr processes that render views
- **Fail-fast scope:** Dotfiles (.ulp-root, .ulp-scope, .ulp-ignore) enforce boundaries

**Event Processing Pipeline:**
```
Events (JSONL) → Validate (Scope + NF) → Store (TileStore) → Materialize (Shadow Canvas) → BASIS32 (derived features) → Project (Views)
```

**Projection Ladder:**
- 1D: text/logs/transcripts/audio
- 2D: pages/images/diagrams/video frames
- 3D: meshes/scenes
- 4D+: time-in-space/simulation

## Implementation Phases

### Phase 0: Foundation Setup (Days 1-3)

#### Monorepo Scaffolding

Create workspace structure with TypeScript, build tools, and package management.

**Files to create:**

1. `package.json` - Root with workspaces
2. `tsconfig.json` - Project references
3. `tsconfig.base.json` - Shared compiler options
4. `.gitignore` - Ignore node_modules, dist, build artifacts
5. `README.md` - Project overview, link to CLAUDE.md

**Directory structure:**
```
metaverse-kit/
├── packages/
├── apps/
├── tools/
├── world-format/
└── examples/
```

**Commands:**
```bash
npm init -y
npm install -D typescript vite @types/node
mkdir -p packages apps tools world-format examples
```

---

### Phase 1: Core Protocol & Addressing (Days 4-10)

#### 1.1 Protocol Package (`packages/protocol/`)

**Priority: CRITICAL** - Foundation for entire system

**Files:**
- `package.json` - Package metadata
- `tsconfig.json` - TypeScript config
- `src/types.ts` - **MOST CRITICAL FILE**
  - Event envelope types (EventId, SpaceId, TileId, LayerId, ActorId)
  - Scope types (Realm, Authority, Boundary, Policy, Invariant)
  - Transform types (position, rotation_quat, scale)
  - Event operation types (CreateNodeEvent, UpdateTransformEvent, etc.)
  - Reference operations:
    - set_geometry (svg/obj/glb)
    - set_media (svg/mtl/obj/glb/wav/mp4)
    - set_text (plain/markdown/code/json/yaml)
    - set_document (pdf/md-page/canvas2d/html)
  - Tile Store types (HashRef, Manifest, Index, Snapshot)
- `src/validate.ts` - **CRITICAL**
  - validateScope()
  - validateTransform()
  - validateEnvelope()
  - validateWorldEvent()
  - ROOT_INVARIANTS enforcement
- `src/index.ts` - Barrel exports

**Key Types:**
```typescript
EventEnvelope {
  event_id, timestamp, space_id, layer_id, actor_id,
  operation, scope, preserves_invariants, previous_events, tile
}
```

**Operations (v0):** create_node, update_transform, set_properties, link_nodes, unlink_nodes, delete_node, merge

**Optional (v1)**: set_geometry, set_media, set_text, set_document

**Testing:** 20+ unit tests for validators

---

#### 1.2 ADDR Package (`packages/addr/`)

**Priority: CRITICAL** - Content addressing and canonical JSON

**Files:**
- `src/index.ts` - **CRITICAL**
  - stableStringify() - Deterministic JSON canonicalization
  - hashBytes(), hashUtf8() - sha256 hashing
  - ridFromJson() - RID (immutable content ID)
  - makeHdPath(), sidFromPath() - SID (structural pointer)

**Key Concept:**
- RID = content hash (what it is)
- SID = HD path hash (where it lives)

**Testing:** 15+ tests for canonical ordering, hash determinism

---

#### 1.3 NF Package (`packages/nf/`)

**Priority: HIGH** - Normalization and equivalence

**Files:**
- `src/index.ts`
  - normalizeEvent() - Ensure ROOT_INVARIANTS
  - orderEventsDeterministic() - Sort by timestamp + event_id
  - pruneNoOps() - Remove duplicate transforms
  - traceHash() - Normalized trace hash
  - normalizeState() - Canonical tile state
  - equivalentStates() - State comparison

**Testing:** 12+ tests for ordering, pruning, state equivalence

---

#### 1.4 PF16 Package (`packages/pf16/`)

**Priority: LOW** - Can defer to v1

Typed 16-slot identity composition. Skip for MVP, implement later.

---

### Phase 2: Storage Layer (Days 11-18)

#### 2.1 Tile Store Package (`packages/tilestore/`)

**Priority: CRITICAL** - Core persistence engine

**Files:**
- `src/index.ts` - **CRITICAL**
  - class TileStore
    - appendTileEvents() - Buffer events
    - flushTile() - Write segment, update manifest/index
    - getTileTip() - Return index.json
    - getSegmentsSince() - Filter manifest
    - getObject() - Fetch content-addressed blob
  - Periodic flush timer

**Storage Layout:**
```
world/
├── objects/sha256/<ab>/<cdef...>  # Content-addressed blobs
└── spaces/<space_id>/
    └── tiles/<tile_id>/
        ├── index.json          # Tip pointer
        ├── manifest.json       # Segment list
        └── snapshots/          # Materialized states
```

**Key Operations:**
1. Append events to buffer
2. Flush buffer → segment blob (objects/)
3. Update manifest (append segment ref)
4. Update index (tip pointer)
5. Periodically create snapshots

**Testing:** 15+ tests for flush, manifest updates, retrieval

---

#### 2.2 Shadow Canvas Package (`packages/shadow-canvas/`)

**Priority: CRITICAL** - Deterministic state materializer

**Files:**
- `src/index.ts` - **CRITICAL**
  - interface TileState { tile_id, nodes: Map<NodeId, NodeState> }
  - stateFromSnapshot() - Load from snapshot
  - applyEvent() - Apply single event (switch on operation)
  - buildState() - snapshot + events → state
  - makeSnapshot() - state → snapshot blob

**Apply Rules:**
- create_node: Insert if absent
- update_transform: LWW by timestamp + event_id
- set_properties: Merge keys (LWW per key)
- link_nodes: Add to links array (OR-Set semantics)
- unlink_nodes: Remove by relation + to
- delete_node: Set deleted flag (tombstone)

**Testing:** 18+ tests for each operation, ordering, determinism

---

#### 2.3 Scope Package (`packages/scope/`)

**Priority: MEDIUM** - Can simplify for v0

For MVP: Use default scope everywhere. Defer full dotfile parsing to v1.

---

### Phase 3: Server Application (Days 19-25)

#### 3.1 Server Package (`apps/server/`)

**Priority: CRITICAL** - HTTP API + sync

**Files:**
- `package.json` - Dependencies: none (use Node http)
- `src/server.ts` - **CRITICAL**
  - HTTP server on port 8080
  - GET /tile_tip?space_id=&tile_id=
  - POST /segments_since {space_id, tile_id, after_event}
  - GET /object/:hash
  - POST /append_events {space_id, tile_id, events[]}

**Implementation:**
- Use TileStore instance
- Validate events with validateWorldEvent()
- Normalize with normalizeEvent()
- Return JSON responses

**Environment:**
- WORLD env var for root directory (default: ./world)

**Testing:** Integration tests for each endpoint

---

### Phase 4: Client Application (Days 26-35)

#### 4.1 Client Package (`apps/client/`)

**Priority: CRITICAL** - React infinite canvas UI

**Files:**
- `package.json` - Dependencies: react, react-dom, vite
- `vite.config.ts` - Proxy to server on localhost:8080
- `src/App.tsx` - Main app
  - loadTile() - Fetch tip, segments, build state
  - Viewport state (offsetX, offsetY, scale)
- `src/components/Canvas.tsx` - **CRITICAL**
  - Render nodes from TileState
  - Pan (drag) and zoom (wheel)
  - worldToScreen() coordinate transform
- `src/components/Toolbar.tsx` - Drawing tools (v1)
- `src/components/Timeline.tsx` - Replay scrubber (v1)

**Features (v0):**
- Load and display tile
- Pan and zoom viewport
- Render rectangles from nodes

**Features (v1 - partial):**
- Drawing tools (create rectangles)
- Multi-user cursors (WebSocket presence)
- Timeline scrubber
- 3D view toggle
- Reference projections:
  - SVG (2D), OBJ/MTL/GLB (3D), WAV/MP4 (audio/video)
  - Text (1D logs/transcripts) and document/page views (2D)

**Testing:** E2E tests with Playwright

---

### Phase 5: Projectors (Days 36-40)

#### 5.1 Projector 2D Package (`packages/projector-2d/`)

**Priority: MEDIUM**

Convert TileState to 2D render primitives. Can be inline in client for MVP.

---

#### 5.2 Projector 3D Package (`packages/projector-3d/`)

**Priority: MEDIUM** - Partial v1 feature

**Files:**
- `src/index.ts`
  - Convert nodes to Three.js scene graph
  - Extrude 2D shapes to 3D
  - Camera controls

**Dependencies:** three

**Integration:** React Three Fiber in client

---

### Phase 6: CLI Tools (Days 41-45)

**Status:** Implemented (mv-init, mv-host, mv-client, mv-replay)

#### 6.1 mv-init (`tools/mv-init/`)

**Priority: HIGH**

**Implementation:**
```bash
#!/usr/bin/env node
# Create world/ directory with dotfiles
mkdir -p world/spaces/demo/tiles
echo '{}' > world/spaces/demo/tiles/z0/x0/y0/index.json
# Create .ulp-root, .ulp-scope, .ulp-ignore
```

---

#### 6.2 mv-host (`tools/mv-host/`)

**Priority: HIGH**

Wrapper script to run server with WORLD env var.

---

#### 6.3 mv-client (`tools/mv-client/`)

**Priority: MEDIUM**

Open browser to localhost:3000

---

#### 6.4 mv-replay (`tools/mv-replay/`)

**Priority: LOW** - Can defer to v1

Extract event ranges from tiles.

---

### Phase 7: Testing & Integration (Days 46-50)

#### Test Suites

**Unit Tests (per package):**
- protocol: 20+ tests
- addr: 15+ tests
- nf: 12+ tests
- tilestore: 15+ tests
- shadow-canvas: 18+ tests

**Integration Tests:**
- Multi-tile sync
- Event ordering across clients
- Snapshot + replay equivalence
- Concurrent append handling
- State convergence

**Performance Tests:**
- 10k events replay time
- Snapshot interval tuning
- Viewport tile subscription churn

---

### Phase 8: Examples & Quickstart (Days 51-55)

#### Demo World

Create `examples/demo-world/` with:
- Pre-populated space with objects
- .ulp-root with default scope
- Sample events showing various operations

#### QUICKSTART.md

Write guide for "run in 10 minutes":
```bash
git clone ...
cd metaverse-kit
npm install
npm run build
npm run mv-init demo
npm run mv-host demo &
npm run dev
# Open http://localhost:3000
```

---

## Critical Path (Minimum Viable Implementation)

To get a functional system as quickly as possible, implement in this order:

### Week 1: Foundation + Protocol
1. Monorepo setup (package.json, tsconfig)
2. `packages/protocol/src/types.ts` ← **START HERE**
3. `packages/protocol/src/validate.ts`
4. `packages/addr/src/index.ts`
5. `packages/nf/src/index.ts`

**Checkpoint:** Types and validation working, tests passing

### Week 2: Storage
6. `packages/tilestore/src/index.ts` ← **CORE PERSISTENCE**
7. `packages/shadow-canvas/src/index.ts` ← **STATE MATERIALIZER**
8. Test tile write/read cycle
9. Test shadow canvas apply

**Checkpoint:** Can store events and materialize state

### Week 3: Server
10. `apps/server/src/server.ts` ← **HTTP API**
11. Test all endpoints
12. Integration test: append + retrieve

**Checkpoint:** Server running, tiles accessible via HTTP

### Week 4: Client (Basic)
13. `apps/client/src/App.tsx`
14. `apps/client/src/components/Canvas.tsx` ← **RENDER ENGINE**
15. Test load and display

**Checkpoint:** Can view tiles in browser

### Week 5: Client (Interactive)
16. Add pan/zoom to Canvas
17. Add drawing tools (create rectangles)
18. WebSocket for real-time sync (optional for v0)

**Checkpoint:** Interactive 2D canvas working

### Week 6: Polish & CLI
19. CLI tools (mv-init, mv-host, mv-client)
20. Demo world
21. QUICKSTART.md
22. Bug fixes

**Checkpoint:** MVP ready to share

---

## Dependencies & External Libraries

**Minimal dependencies (philosophy: avoid bloat):**

**Root:**
- typescript
- vite

**Server:**
- None (use Node.js http module)

**Client:**
- react
- react-dom
- @types/react

**Optional (v1):**
- three, @react-three/fiber (3D view)
- ws (WebSocket for presence)

**Development:**
- @types/node
- playwright (E2E tests)

---

## Build Commands

**Root package.json scripts:**
```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "dev:server": "cd apps/server && node --watch src/server.ts",
    "dev:client": "cd apps/client && vite",
    "clean": "rm -rf node_modules packages/*/dist apps/*/dist"
  }
}
```

---

## Verification & Testing

### End-to-End Test Scenario

1. **Initialize world:**
   ```bash
   npm run mv-init demo
   ```
   - Verify world/ directory created
   - Verify .ulp-root exists

2. **Start server:**
   ```bash
   npm run mv-host demo
   ```
   - Server listens on :8080
   - Can query /tile_tip

3. **Start client:**
   ```bash
   npm run dev:client
   ```
   - Browser opens to localhost:3000
   - Empty canvas displays

4. **Create rectangle:**
   - Click "Draw Rectangle" tool
   - Click and drag on canvas
   - Event sent to server
   - State updates
   - Rectangle renders

5. **Reload page:**
   - Canvas state persists
   - Snapshot + segments loaded
   - Same rectangles visible

6. **Open second browser:**
   - Same canvas state
   - Multi-user cursor visible (if WebSocket implemented)

### Success Criteria

- ✅ Events stored as JSONL segments
- ✅ Segments content-addressed in objects/
- ✅ Manifest and index updated correctly
- ✅ Shadow canvas builds correct state
- ✅ State deterministic (same events → same state)
- ✅ Viewport pan/zoom works
- ✅ Can create and render rectangles
- ✅ State persists across page reload
- ✅ Multiple clients can view same tile

---

## Known Limitations & Deferred Features

**Deferred to v1+:**
- PF16 identity composition
- Full dotfile scope parsing (.ulp-root, .ulp-scope, .ulp-ignore)
- Multi-tile viewport subscriptions
- WebSocket real-time presence
- Timeline replay scrubber
- Undo/redo
- Physics solver
- 3D full implementation (only partial in v1)

**Deferred to v2+:**
- AR/VR support
- Deterministic physics
- Sensor integration (ESP32)
- DHT/peer-to-peer discovery

**Deferred to v3+:**
- Federation
- Signed events
- Cryptographic verification

---

## Critical Files Summary

The 5 most critical files to implement first:

1. **`packages/protocol/src/types.ts`** (Foundation types)
2. **`packages/protocol/src/validate.ts`** (Fail-fast validation)
3. **`packages/tilestore/src/index.ts`** (Storage engine)
4. **`packages/shadow-canvas/src/index.ts`** (State materializer)
5. **`apps/server/src/server.ts`** (HTTP API)

With these 5 files + supporting package.json files, you have a functional backend.

---

## Implementation Notes

### Development Environment

This is being built on Termux (Android), which has some constraints:
- Use Node.js instead of Deno/Bun (better Termux support)
- Avoid native dependencies
- Test on actual device, not emulator

### File Paths

All paths are absolute from `/data/data/com.termux/files/home/metaverse-kit/`

### Git Strategy

After implementation:
1. Initial commit: Add all source files
2. Tag v0.1.0-mvp
3. Branch for v1 features

### Documentation Updates

After implementation:
1. Update README.md with build instructions
2. Create QUICKSTART.md
3. Add inline code comments
4. Update CLAUDE.md if architecture diverges

---

## Next Steps After Plan Approval

1. Create monorepo structure
2. Set up package.json files
3. Implement packages/protocol (types + validators)
4. Implement packages/addr (canonical JSON + hashing)
5. Implement packages/nf (normalization)
6. Implement packages/tilestore (storage)
7. Implement packages/shadow-canvas (materializer)
8. Implement apps/server (HTTP API)
9. Implement apps/client (React canvas)
10. Create CLI tools
11. Add tests
12. Create demo world
13. Write QUICKSTART.md
14. Test end-to-end

Estimated total implementation time: **6-8 weeks** for full v0 MVP + partial v1.
