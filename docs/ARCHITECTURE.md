# Architecture

This project is a protocol/runtime stack, not a single app.

## Core model

- Canonical truth is append-only and content-addressed.
- Replay identity is deterministic for identical inputs.
- Projection surfaces are replaceable and non-authoritative.

## Runtime hierarchy

1. Authority doctrine (`hardware-os`)
2. Hypervisor/gating (`metaverse-build`)
3. Deterministic substrate (`lattice-runtime`)
4. Application VM (`metaverse-kit`)
5. Canonical IR/protocol artifacts
6. Projection adapters (2D/3D/AR/VR/portal/export)

## Authority boundaries

- Canonical artifacts are read-only in portal/runtime projection code.
- UI state is advisory.
- Proposal artifacts are non-authoritative until accepted by external authority flows.

## Demo release boundary

Phase 0 release ships three artifacts:

- Runtime toolchain (builders)
- `demo.bundle` (portable canonical demo world)
- Portal viewer (static verifier + replay UI)

The portal verifies before render and fails closed on corruption.
