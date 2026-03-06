# Layer Contract: metaverse-kit Authority Surface

This contract instantiates `docs/templates/LAYER_CONTRACT.md` for the canonical authority layer.

## Component

- Name: `metaverse-kit authority surface`
- Repository path: `/home/main/devops/metaverse-kit`
- Owner: protocol maintainers
- Status: active

## Layer Declaration

- Layer: doctrine + ir
- Why this layer: this repo defines canonical protocol semantics, ABI law, and replay/guard contracts.

## Authority Class

- Authority class: authoritative
- Authority boundary statement:
  - What this component is allowed to decide: ABI keysets, canonical hashing rules, must-reject behavior, proof/guard requirements, protocol versioning.
  - What this component must never decide: runtime-local execution heuristics, UI-only interaction state, transport-specific shortcuts that change artifact meaning.

## Inputs

- Input artifact: wave and protocol change proposals
  - ABI/version: `docs/WAVE*.md`, `docs/PROTOCOL_SPEC.md`
  - Required invariants: strict keysets, string membrane where declared, canonical digest, replay determinism.
- Input artifact: fixture/proof updates
  - ABI/version: `dev-docs/**`, `docs/proofs/*.latest.md`
  - Required invariants: golden determinism, fail-closed reject corpus, explicit gate receipts.

## Outputs

- Output artifact: canonical protocol ABIs and functions docs
  - ABI/version: `docs/WAVE*.md`
  - Deterministic encoding: canonical markdown + frozen IDs/tables
  - Authority class of output: authoritative
- Output artifact: executable contract gates and corpora
  - ABI/version: `scripts/check-*`, `scripts/wave*-golden.sh`, `scripts/wave*-must-reject.sh`, workflows
  - Deterministic encoding: reproducible shell/tool execution over pinned fixtures
  - Authority class of output: authoritative

## Forbidden Behavior

- Must not move canonical authority into `apps/*`, `portal/*`, or projection adapters.
- Must not accept malformed artifacts via permissive parsing.
- Must not merge wave semantics without matching ABI + fixtures + gates + CI.
- Must not introduce hidden mutation channels through release/build tooling.

## Replay Guarantee

- Replay class: deterministic
- Replay proof method: wave golden scripts, must-reject scripts, closure spine receipts
- Golden coverage: Wave17 through Wave31 contract lanes
- Must-reject coverage: unknown key, missing key, digest mismatch, bad authority, replay mismatch

## Failure Model

- Fail-closed conditions: schema mismatch, digest mismatch, frozen-ID drift, receipt drift
- Expected error prefixes/messages: `ERROR:` and explicit guard failure labels from check scripts
- Recovery path: fix ABI/docs/tools/fixtures in same lane, rerun gates, refresh receipts

## Security / Integrity

- Content-addressing scheme: canonical JSON + `sha256:<64 lowercase hex>`
- Signature/receipt requirements: proof receipts and closure spine latest receipts are required for governed lanes
- Domain separation statement: function/profile IDs are frozen per wave docs
- Trust assumptions: canonical semantics are reviewed/merged only via guarded CI paths

## Integration Gates

- Required spine step(s): closure spine smoke labels for active wave lanes
- Required test scripts: wave-specific `check:*` gates, plus `release:verify`
- Required fixtures: `dev-docs/wave*/**`
- Required goldens: wave golden + must-reject corpora

## Change Control

- Version bump rule: semantic changes require versioned ABI updates and migration notes when applicable
- Backward compatibility rule: additive preferred; semantic breaks require explicit wave/version bump
- Deprecation path: document in `docs/COMPATIBILITY.md` and release roadmap

## Sign-off

- Author: Codex draft
- Reviewer: pending
- Date (YYYY-MM-DD): 2026-03-05
