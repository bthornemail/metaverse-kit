# Governance

This document defines how protocol decisions are made and constrained.

## Governance model

- Model: maintainer-led, artifact-first governance.
- Decision source: canonical docs + executable checks.
- Authority boundary: governance may define acceptance policy, but cannot bypass deterministic verification.

## Decision classes

1. Patch (`vX.Y.Z`)
- Bugfixes and documentation corrections.
- No semantic/protocol drift.

2. Minor (`vX.Y.0`)
- Backward-compatible additive capability.
- Must include updated docs and tests.

3. Major (`vX.0.0`)
- Protocol or authority model changes.
- Requires explicit migration and compatibility statement.

## Required gates for merge

- `npm run -s check:portal-contract`
- `bash scripts/demo-portal-eval.sh`
- release pack reproducibility workflow green (when affected paths change)

Merges that fail these gates do not ship.

## Authority discipline rules

- Canonical artifacts remain read-only in portal/runtime projection code.
- Proposal artifacts are advisory until accepted by external authority flows.
- Projection/UI state is never canonical truth.
- No hidden mutation channels.

## Protocol change process

A protocol change PR must include:

1. Version bump rationale
2. Updated frozen docs/ABI references
3. Migration notes
4. Backward compatibility statement
5. Must-reject and deterministic replay coverage

If any item is missing, protocol change is rejected.

## Release discipline

- Tag first, then build from tagged commit.
- Publish checksums and release notes with artifacts.
- Verify release artifacts independently before announcement.

## Conflict resolution

- Source of truth for disputes: executable checks + frozen docs in repo.
- If docs and behavior diverge, behavior is corrected or version-bumped.
- Ambiguous layer placement blocks implementation until explicit placement is documented.

## Non-goals

- No governance by hidden convention.
- No authority through UI behavior.
- No semantic expansion without versioned contract updates.
