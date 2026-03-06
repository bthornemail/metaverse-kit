# Layer Contract: metaverse-kit/apps Projection and Interaction Shell

This contract defines `apps/*` as the consumer-facing realization shell.

## Component

- Name: `metaverse-kit apps projection shell`
- Repository path: `/home/main/devops/metaverse-kit/apps`
- Owner: app maintainers
- Status: active

## Layer Declaration

- Layer: projection
- Why this layer: apps render and interact with canonical/advisory artifacts but do not author canonical truth.

## Authority Class

- Authority class: advisory
- Authority boundary statement:
  - What this component is allowed to decide: UX state, visualization, interactive filtering, local view models, proposal drafting UI.
  - What this component must never decide: canonical protocol semantics, authoritative state mutation, validator bypass outcomes.

## Inputs

- Input artifact: canonical/advisory wave artifacts
  - ABI/version: Wave17..Wave31 artifacts consumed via server/tooling
  - Required invariants: strict validation before display/mutation pathways, digest verification where contract requires.
- Input artifact: runtime projections and host streams
  - ABI/version: server and runtime projection feeds
  - Required invariants: deterministic ordering and explicit error handling/quarantine.

## Outputs

- Output artifact: rendered views and interaction state
  - ABI/version: UI-local, non-canonical
  - Deterministic encoding: best-effort deterministic rendering for identical inputs
  - Authority class of output: advisory
- Output artifact: proposals/intents (when supported)
  - ABI/version: proposal artifacts only (non-authoritative)
  - Deterministic encoding: canonicalized proposal payloads where specified
  - Authority class of output: advisory

## Forbidden Behavior

- Must not mutate canonical artifacts directly from UI state.
- Must not treat unverified artifacts as authoritative.
- Must not silently coerce malformed artifacts into accepted state.
- Must not perform hidden side-effect writes outside declared proposal channels.

## Replay Guarantee

- Replay class: deterministic for validation/panel model logic; rendering may be advisory
- Replay proof method: client contract tests, fixtures-contract checks, isolated typecheck gates
- Golden coverage: wave-specific client panels and fixture checks (for active lanes)
- Must-reject coverage: bad authority, unknown keys, digest mismatch, reference mismatch

## Failure Model

- Fail-closed conditions: invalid artifact schema/digest/authority for guarded panels
- Expected error prefixes/messages: explicit invalid artifact banners/states
- Recovery path: load valid artifacts, rerun client contract checks

## Security / Integrity

- Content-addressing scheme: digest-first cross-linking and reference checks
- Signature/receipt requirements: display and verify receipts where provided
- Domain separation statement: UI output is projection-only and non-authoritative
- Trust assumptions: canonical validation logic lives in authority/runtime layers, not in ad hoc UI code

## Integration Gates

- Required spine step(s): only if app gate is included in canonical spine path
- Required test scripts: client panel contract checks and fixture checks for active wave lanes
- Required fixtures: `dev-docs/wave*/ui-*` where applicable
- Required goldens: panel model and validator golden tests

## Change Control

- Version bump rule: app-only UI changes may be patch; validator/contract behavior changes require explicit docs/tests
- Backward compatibility rule: preserve fail-closed behavior for existing artifact versions
- Deprecation path: announce in app docs and remove only after replacement guard is live

## Sign-off

- Author: Codex draft
- Reviewer: pending
- Date (YYYY-MM-DD): 2026-03-05
