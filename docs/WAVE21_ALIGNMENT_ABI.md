# WAVE21 Alignment ABI

Status: closure validator (cross-wave coherence predicate).

## Purpose

`wave21.alignment_report.v0` validates cross-wave coherence for:

- `wave16.narrative_state.v0`
- `wave19.world_entities.v0`
- `wave19.world_graph.v0`
- `wave20.behavior_grammar.v0`

This layer adds no world structure. It only validates alignment.

## Canonical Rules

- UTF-8 JSON
- sorted keys
- compact separators
- trailing newline
- strict keysets
- string membrane for leaf scalars
- digests: `sha256:<64hex>`

## Top-level keyset (exact)

- `v`
- `authority`
- `narrative_state_digest`
- `world_entities_digest`
- `world_graph_digest`
- `behavior_grammar_digest`
- `checks`
- `projection_order`
- `status`
- `digest`

Rules:

- `v` MUST be `wave21.alignment_report.v0`
- `authority` MUST be `advisory`
- `status` MUST be `valid`
- `digest` MUST be sha256 of canonical JSON without `digest`

## `checks` keyset (exact)

- `behavior_targets_resolve`
- `behavior_effects_supported`
- `narrative_roles_resolve`
- `acyclic_behavior_graph`
- `projection_order_commutes`

All values are `"0"|"1"` strings. Emit MUST fail if any check is `"0"`.

## Invariants

1. Behavior source/target nodes resolve in world entities + world graph
2. Behavior effect/verb pairs are valid (`RELATE↔propose_relation`, `UNRELATE↔propose_unrelation`)
3. Narrative dialogue roles are from finite allowlist
4. Behavior graph is acyclic
5. Projection order is canonical and commutative under canonical digest fold

## Reject Rules (minimum)

Reject on:

- missing/unknown keys
- non-string leaf values
- bad digest formats
- failed checks
- status != `valid`
- digest mismatch
