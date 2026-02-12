# Release Notes

## v0.1.0 - Deterministic World Demo

This release publishes a protocol-first demo surface:

- Deterministic demo bundle packaging
- Fail-closed bundle integrity verification
- Static portal replay viewer
- Proposal-only export path (no canonical mutation)
- Portal contract guard and demo evaluation harness

## Guarantees

- Canonical artifacts remain read-only in the portal path.
- Replay for identical inputs is deterministic.
- Integrity verification is mandatory before render.
- Proposal export binds to base bundle digest.

## Non-goals

- No new authority layer
- No hidden runtime mutation path
- No network dependency for core replay
- No simulation authority inside portal

## Operational checks

- `npm run -s check:portal-contract`
- `bash scripts/demo-portal-eval.sh`
- `bash scripts/release-pack.sh`
- `bash scripts/verify-release.sh --dist dist/metaverse-kit-v0.1`
