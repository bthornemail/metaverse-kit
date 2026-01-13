# Metaverse Kit

A local-first, event-sourced metaverse toolkit with deterministic replay, multi-projection rendering, and a draw.io-class editor shell. It is designed for offline-first collaboration and federated meaning without authority collapse.

## Documentation

- README: `README.md`
- Quick Start: `QUICKSTART.md`
- Publishing: `PUBLISHING.md`
- Implementation Plan: `dev-docs/PLANS/Implementation Plan.md`
- SPABBS RFC: `dev-docs/1007 - RFC - Staged Polymorphic Automaton with Blackboard Semantics (SPABBS).md`
- BASIS32/EXT32: `dev-docs/1008 - BASIS32 -- EXT32 - Layered Blackboard Identity for Projective, Federated Worlds.md`
- EXT32 Packs: `dev-docs/EXT32_PACKS.md`
- EXT32 Schema: `dev-docs/EXT32_PACK_SCHEMA.json`
- Package Docs:
  - `docs/packages/protocol.md`
  - `docs/packages/addr.md`
  - `docs/packages/nf.md`
  - `docs/packages/shadow-canvas.md`
  - `docs/packages/tilestore.md`
  - `docs/packages/basis32.md`
  - `docs/packages/ext32.md`
  - `docs/packages/discovery.md`
- App Docs:
  - `docs/apps/server.md`
  - `docs/apps/client.md`
  - `docs/apps/mcp-server.md`
  - `docs/apps/mcp-client.md`
- Tool Docs:
  - `docs/tools/mv-init.md`
  - `docs/tools/mv-host.md`
  - `docs/tools/mv-client.md`
  - `docs/tools/mv-replay.md`
  - `docs/tools/mv-ext32.md`

## Architecture

The system is built around an append-only event ledger, deterministic replay, and projections that are derived rather than authored. The core invariants are documented in `dev-docs/`.

## Current State

### Editor
- Draw.io-style 2D editor shell: palette + inspector
- Selection, multi-select, marquee, move/resize/rotate
- Connectors with routing modes and editable relations
- Group/ungroup, timeline playhead, markers, keyframes

### Projections
- 1D list, 2D canvas, 3D scene, voxel projection
- Narrative mode + camera/observation mode

### Federation
- BASIS32 derived features
- EXT32 pack registry (server + client UI + CLI)
- Proposal/acceptance channel for federated features

### Export
- Native bundle export
- SVG/PNG/MP4 exports with configurable bounds

## Packages

- `@metaverse-kit/protocol` — event types + validators
- `@metaverse-kit/addr` — content addressing (RID/SID)
- `@metaverse-kit/nf` — normalization and equivalence
- `@metaverse-kit/shadow-canvas` — deterministic state materializer
- `@metaverse-kit/tilestore` — segment/manifest/snapshot storage
- `@metaverse-kit/basis32` — deterministic feature basis
- `@metaverse-kit/ext32` — federated pack registry
- `@metaverse-kit/discovery` — discovery graph and UDP gossip

## Licensing

- Architecture Preservation License (APL): `licenses/architecture-preservation-license.md`
- Hitecture Preservation License (HPL): `licenses/hitecture-preservation-license.md`

## Maintainer

Brian Thorne  
Independent Researcher - Topological Consensus and Autonomous AI  
Universal Life Protocol  
Los Angeles, CA  
Email: bthornemail@gmail.com  
GitHub: https://github.com/bthornemail/metaverse-kit  
Profile: https://github.com/bthornemailin/brian-thorne-5b8a96112
