# Layer Boundaries

Status: Draft

This document defines explicit layer boundaries for SPABBS and how they map to
the current codebase.

## Layer Map (initial)

- L0: Trace / Authority
  - Owner: event trace, PF16 authority checks
  - Writes: local blackboard (authoritative)
- L1: BASIS32
  - Owner: deterministic local features
  - Reads: L0 trace
  - Writes: derived_feature32 events
- L2: EXT32
  - Owner: federated proposals
  - Reads: L0 + L1 outputs
  - Writes: proposal blackboard (non-authoritative)
- L3: Projection
  - Owner: rendering/projectors
  - Reads: L0 + L1 + L2
  - Writes: none (view only)

## Blackboards

- `local_blackboard` (L0): authoritative
- `feature_blackboard` (L1): derived, recomputable
- `proposal_blackboard` (L2): proposal-only

## Implementation Commitments

1. L0 MUST NOT accept proposals from L2 without explicit acceptance.
2. L1 MUST be deterministic and replayable.
3. L2 MUST be optional and never required for local operation.
4. L3 MUST treat L2 as hints, not truth.
