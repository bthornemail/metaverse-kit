# Packages

This document summarizes each package in the monorepo and its role in the system.

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
