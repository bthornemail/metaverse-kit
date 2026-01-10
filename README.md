# Metaverse Starter Kit

A distributed, local-first collaborative infinite canvas metaverse built on append-only event traces.

## Overview

The Metaverse Starter Kit enables multi-user editing with deterministic replay, supporting projections into 2D, 3D, AR, and VR from the same event stream. It's designed to work offline, synchronize opportunistically, and scale from embedded devices (ESP32) to full metaverse applications.

### Core Philosophy

- **Truth is append-only**: Reality is an event ledger. Nothing is overwritten—only added.
- **State is derived**: Current state is computed from history via shadow canvases and snapshots.
- **Projection over production**: Media/views are projected from events, not authored separately.
- **Local-first**: Everything works offline and synchronizes opportunistically.
- **Fail-fast scope**: Boundaries and authority are explicit and enforced early via dotfiles.
- **Deterministic replay**: Replay must always converge to the same state.

## Architecture

### Three Execution Classes

1. **Host runtime** (Node/Deno/Bun): Runs Tile Store, manages segments/manifests/snapshots, enforces scope
2. **Worker runtime** (WASM): Runs projectors (2D/3D/physics/audio), sandboxed and deterministic
3. **Client runtime** (browser/desktop/mobile/VR): UI, gestures, cursors, event creation

### Event Processing Pipeline

```
Events (JSONL) → Validate (Scope + NF) → Store (TileStore) → Materialize (Shadow Canvas) → Project (Views)
```

## Repository Structure

```
metaverse-kit/
├── packages/          # Core libraries
│   ├── protocol/      # Event types + validators
│   ├── addr/          # Content addressing (RID/SID)
│   ├── nf/            # Normalization + equivalence
│   ├── shadow-canvas/ # State materializer
│   ├── tilestore/     # Storage engine
│   └── ...
├── apps/
│   ├── server/        # HTTP/WebSocket API
│   └── client/        # React infinite canvas UI
├── tools/             # CLI utilities
│   ├── mv-init/       # Create world
│   ├── mv-host/       # Run server
│   └── mv-client/     # Open client
├── world-format/      # Dotfiles (.ulp-root, .ulp-scope, .ulp-ignore)
├── examples/          # Demo worlds
├── dev-docs/          # Architecture documentation
└── CLAUDE.md          # Development guide for Claude Code
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
git clone https://github.com/your-org/metaverse-kit.git
cd metaverse-kit
npm install
npm run build
```

### Quick Start

Coming soon - see implementation plan in `/data/data/com.termux/files/home/.claude/plans/bright-swinging-mochi.md`

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

**Current Phase:** Phase 0 - Foundation Setup

**Implementation Progress:**
- ✅ Monorepo structure
- ⏳ Core protocol types
- ⏳ Storage layer
- ⏳ Server application
- ⏳ Client application

See the implementation plan for detailed roadmap.

## License

TBD

## Contributing

Coming soon
