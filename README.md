# Metaverse Starter Kit

A local-first, event-sourced metaverse toolkit with deterministic replay, multi-projection rendering, and a draw.io-class editor shell. It is built to scale from offline-first collaboration to federated worlds without collapsing authority.

## Overview

The Metaverse Starter Kit enables multi-user editing with deterministic replay, supporting projections into 2D, 3D, AR, and VR from the same event stream. It's designed to work offline, synchronize opportunistically, and scale from embedded devices (ESP32) to full metaverse applications.

### Core Philosophy

- **Truth is append-only**: Reality is an event ledger. Nothing is overwritten—only added.
- **State is derived**: Current state is computed from history via shadow canvases and snapshots.
- **Projection over production**: Media/views are projected from events, not authored separately.
- **Local-first**: Everything works offline and synchronizes opportunistically.
- **Fail-fast scope**: Boundaries and authority are explicit and enforced early via dotfiles.
- **Deterministic replay**: Replay must always converge to the same state.
- **Meaning-first**: Roles and semantics drive appearance, not the other way around.

## Architecture

### Three Execution Classes

1. **Host runtime** (Node/Deno/Bun): Runs Tile Store, manages segments/manifests/snapshots, enforces scope
2. **Worker runtime** (WASM): Runs projectors (2D/3D/physics/audio), sandboxed and deterministic
3. **Client runtime** (browser/desktop/mobile/VR): UI, gestures, cursors, event creation

### Event Processing Pipeline

```
Events (JSONL) → Validate (Scope + NF) → Store (TileStore) → Materialize (Shadow Canvas) → BASIS32 → Project (Views)
```

### SPABBS / EXT32 (v0)

- Layered blackboard boundaries (L0/L1/L2/L3)
- Proposal + acceptance channel (non-authoritative EXT32)
- EXT32 pack registry for federated feature packs

## Capabilities (Current)

### Editor (draw.io-class)
- Palette + inspector panels for stencil-driven editing
- Selection, multi-select, marquee, move/resize/rotate
- Connectors with routing (orthogonal/straight/bezier)
- Group/ungroup and relation editing
- Timeline playhead with markers, keyframes, cuts, and FPS/EPS playback

### Projections
- 1D: event/narrative list
- 2D: canvas with SVG/MP4/WAV references
- 3D: GLB/OBJ/MTL projection + camera presets
- Voxel: baseline voxel projection
- Narrative mode + movie/camera observation mode

### Export
- Native bundle (events + snapshot + markers + packs)
- SVG / PNG / MP4 exports with configurable size and bounds

### Federation Primitives
- BASIS32 deterministic features
- EXT32 pack registry + proposal/acceptance channel
- Discovery graph + UDP gossip

## Repository Structure

```
metaverse-kit/
├── packages/          # Core libraries
│   ├── protocol/      # Event types + validators
│   ├── addr/          # Content addressing (RID/SID)
│   ├── nf/            # Normalization + equivalence
│   ├── shadow-canvas/ # State materializer
│   ├── tilestore/     # Storage engine
│   ├── basis32/       # Deterministic feature basis
│   ├── ext32/         # EXT32 pack registry
│   ├── discovery/     # Discovery graph
│   └── ...
├── apps/
│   ├── server/        # HTTP/WebSocket API
│   ├── client/        # React infinite canvas UI
│   ├── mcp-server/    # MCP Streamable HTTP server
│   └── mcp-client/    # MCP CLI client
├── tools/             # CLI utilities
│   ├── mv-init/       # Create world
│   ├── mv-host/       # Run server
│   ├── mv-client/     # Open client
│   ├── mv-replay/     # Extract event ranges
│   └── mv-ext32/      # Register EXT32 packs
├── world-format/      # Dotfiles (.ulp-root, .ulp-scope, .ulp-ignore)
├── examples/          # Demo worlds
├── dev-docs/          # Architecture documentation
└── CLAUDE.md          # Development guide for Claude Code
```

## Package Highlights

- `@metaverse-kit/protocol`: event envelope types, validation, scope invariants
- `@metaverse-kit/addr`: content addressing (RID/SID) + canonical JSON
- `@metaverse-kit/nf`: normalization, deterministic ordering, equivalence helpers
- `@metaverse-kit/shadow-canvas`: deterministic state materializer
- `@metaverse-kit/tilestore`: segment/manifest/snapshot storage engine
- `@metaverse-kit/basis32`: deterministic feature basis (derived)
- `@metaverse-kit/ext32`: federated pack registry (proposal layer)
- `@metaverse-kit/discovery`: discovery graph + UDP gossip

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
git clone https://github.com/bthornemail/metaverse-kit.git
cd metaverse-kit
npm install
npm run build
```

### Quick Start

```bash
npm run mv-init -- --world world --space demo
npm run mv-host -- --world world
npm run mv-client
```

See `QUICKSTART.md` for full setup and usage.

## Development

See [CLAUDE.md](./CLAUDE.md) for detailed development guidance including:
- Core protocols and data formats
- Package dependencies
- Testing strategies
- Implementation patterns

## Documentation

Comprehensive architecture documentation is available in the `dev-docs/` directory:

- **09 - Metaverse Starter Kit.md** - Full implementation specification
- **10 - Tile Store v1.0 - Minimum Protocol.md** - Storage protocol
- **11 - World Model.md** - Architecture philosophy
- **04 - Community Metaverse Protocol.md** - White paper

## Status

**Current Phase:** Phase 4/6 - Client + CLI + SPABBS/EXT32 foundation (v0 + partial v1)

**Implementation Progress:**
- ✅ Core protocol + NF + ADDR + TileStore + Shadow Canvas
- ✅ Snapshots, SID pointers, UDP discovery gossip
- ✅ Discovery Graph v1 + broker endpoints
- ✅ 2D canvas + draw.io-style editor shell (palette/inspector)
- ✅ Selection/move/resize/rotate + connectors + routing
- ✅ Timeline playhead + markers + keyframe/cut types
- ✅ Presence cursors over WebSocket
- ✅ 3D view (OBJ/MTL/GLB + MP4/WAV placeholders) + camera presets
- ✅ MCP Streamable HTTP server + client scaffold
- ✅ EXT32 pack registry (server + client UI + CLI)
- ✅ Proposal/acceptance event types + validators

See the implementation plan for detailed roadmap.

## License

This project is released under two project-specific draft licenses:
- Architecture Preservation License (APL) - see `docs/licenses/architecture-preservation-license.md`
- Hitecture Preservation License (HPL) - see `docs/licenses/hitecture-preservation-license.md`

## Contributing

Coming soon
