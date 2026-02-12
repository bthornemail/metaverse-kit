# Demo Portal Known Gaps

This list is intentionally constrained to the current slice.

## Functional gaps

- No in-portal proposal acceptance engine (proposal export only).
- No branch merge UI for proposals.
- No multiplayer/session sync.
- No XR runtime loop.

## Hardening gaps

- CI checks are path-scoped; no scheduled cross-platform reproducibility run yet.
- No signed proposal receipt flow yet.
- No schema version registry for `wave16.proposal_bundle.v0` outside tool docs.

## Performance gaps

- Replay path is optimized for correctness over large-scale throughput.
- No progressive loading for very large harmonic/event logs.

## Constraint reminder

All gaps must be resolved without introducing a new authority layer in portal/runtime components.
