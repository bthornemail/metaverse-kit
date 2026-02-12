# Demo Portal Inventory Map

Scope: boot immersive portal from existing spine components without introducing authority.

## Canonical artifacts (read-only)

- `wave14.story_bundle.v0` (story seed)
- `wave14.civic_world_graph.v0` (world graph)
- `wave14.civic_event_log.v0` (event log)
- `wave14.multiview_manifest.v0` (view manifest)
- `wave15.harmonic_event.v0` NDJSON (harmonic timeline)
- `wave15.observer_profile.v0` (observer normalization)

## Projection adapters (existing)

- `tools/mv-pack-demo` (deterministic demo bundle packager)
- `tools/mv-verify-demo` (deterministic bundle verifier)
- `portal/verify.js` (browser integrity verifier)
- `portal/render.js` (3-pane projections)
- `portal/runtime.js` (replay wiring)

## Portal UI components (existing)

- `portal/index.html` (static shell)
- `portal/styles.css` (view styling)
- `portal/runtime.js` (bundle load, verify, replay)
- `portal/render.js` (harmonic/graph/story panes)

## Export/packaging tools (existing)

- `tools/mv-pack-demo` (bundle construction)
- `tools/mv-proposal-bundle` (proposal-only artifact emit/validate)

## Overlap / non-selected implementations

- `apps/client/*` offers richer editor/runtime features but is intentionally not used for this deterministic portal bootstrap slice.
- Server/network paths (`apps/server`, discovery gossip) are excluded from core replay requirements.

## Layer declarations

- Canonical artifacts: **IR layer** (authoritative inputs, read-only in portal)
- `mv-pack-demo`/`mv-verify-demo`: **projection tooling layer**
- Portal files: **projection/render layer**
- `mv-proposal-bundle`: **advisory proposal layer** (non-authoritative)
