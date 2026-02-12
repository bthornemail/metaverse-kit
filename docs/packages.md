# Packages

This document summarizes each package in the monorepo and its role in the system.

## Runtime hierarchy (declared)

The system is layered. Each layer has a distinct authority boundary.

```
hardware-os doctrine
        ↓
metaverse-build hypervisor
        ↓
lattice-runtime substrate
        ↓
metaverse-kit application VM
        ↓
IR/protocol layers (Wave 15, CanvasL, JSONL)
        ↓
projection/render adapters
```

### Layer responsibilities

- `hardware-os doctrine`: truth/authority model (what can be authoritative vs projection).
- `metaverse-build hypervisor`: capability routing, HALT boundaries, invariant gate orchestration.
- `lattice-runtime substrate`: deterministic process/control runtime (pipes, reconcile loops, supervision).
- `metaverse-kit application VM`: content/event interpretation into world state and projections.
- `IR/protocol layers`: canonical intermediate representations and envelopes.
- `projection/render adapters`: views only; never authoritative state.

### Non-negotiable boundary rules

- Projection artifacts are derived and replaceable.
- Application VM must not become authority kernel.
- Adapters must not emit unvalidated authoritative events.
- Replay identity is content-addressed and deterministic.

## Rumsfeld matrix (runtime landscape)

### Known knowns

- Deterministic replay substrate exists.
- Append-only event model and content-addressing exist.
- Application VM layer exists (`metaverse-kit`).
- Invariant-gated pipeline exists (spine gates and must-reject corpora).

### Known unknowns

- Cross-runtime kernel/guest contract formalization across all repos.
- Complete adapter boundary enforcement and side-channel prevention.
- Performance envelope under large traces and frequent branching.
- Unified IR hierarchy declaration across protocol languages.

### Unknown unknowns (watch list)

- Layer collapse (application VM silently acting as authority).
- Trace inflation without compaction/snapshot policy convergence.
- Semantic drift across multiple IRs and adapters.
- Operator UX drift (projection artifacts mistaken for truth).

## Governance implications

- The engineering task is layering discipline, not inventing another VM.
- New runtime features must declare their layer and authority boundary up front.
- Any component that cannot state its layer is blocked from canonical-path integration.

## Spine contract checklist (required for new components)

Before a package/app/tool is integrated into the canonical path, it must declare:

- **Layer**: doctrine / hypervisor / substrate / app VM / IR / projection.
- **Authority class**: authoritative or advisory.
- **Inputs**: canonical artifact types it accepts.
- **Outputs**: canonical artifact types it emits.
- **Forbidden behavior**: what it must never do (for example: mutate authority state, bypass validators).
- **Replay guarantee**: deterministic or not (non-deterministic components are advisory only).

If any field is unspecified, integration is blocked.

Template:

- `docs/templates/LAYER_CONTRACT.md`

## Core Packages

### @metaverse-kit/protocol

- Defines the event envelope and operation types.
- Provides validation and invariant checks.
- Includes proposal/acceptance events for SPABBS.

### @metaverse-kit/addr

- Content addressing (RID/SID) with canonical JSON.
- Deterministic hashing for content-addressed storage.

### @metaverse-kit/nf

- Normalization utilities for deterministic ordering.
- Equivalence helpers for comparing state.

### @metaverse-kit/shadow-canvas

- Deterministic state materializer.
- Builds TileState from snapshots + segments.

### @metaverse-kit/tilestore

- Storage engine for segments, manifests, snapshots.
- Handles append-only tile event ingestion.

### @metaverse-kit/basis32

- Deterministic feature basis for derived metrics.
- Emits derived_feature32 events.

### @metaverse-kit/ext32

- EXT32 pack registry (federated proposal layer).
- Allows registering and listing EXT32 packs.

### @metaverse-kit/discovery

- Discovery graph + UDP gossip integration.
- Tracks peers and tile tips across the network.

## Apps

### apps/server

- HTTP/WebSocket API for tile sync and event ingestion.
- Presence WebSocket endpoint.
- EXT32 pack registry endpoints.

### apps/client

- Draw.io-style editor shell with palette/inspector.
- Timeline playhead with markers and keyframes.
- 1D/2D/3D/voxel projections and narrative mode.
- Export: native bundle, SVG, PNG, MP4.

### apps/mcp-server

- MCP Streamable HTTP server scaffold.

### apps/mcp-client

- MCP CLI client scaffold.

## Tools

### mv-init

- Creates a new world directory and dotfiles.

### mv-host

- Runs the server with WORLD env set.

### mv-client

- Opens the client in the browser.

### mv-replay

- Extracts event ranges from tiles.

### mv-ext32

- Registers EXT32 packs from JSON via server API.
