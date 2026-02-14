# WAVE21 World Merge ABI

Status: bootstrap freeze (deterministic world-graph merge).

## Purpose

`wave21.world_merge.v0` defines deterministic merge semantics for two `wave19.world_graph.v0` artifacts.

This artifact is advisory and records merge results without mutating canonical state.

## Canonical Rules

- UTF-8 JSON
- sorted keys
- compact separators
- trailing newline
- strict keysets
- string membrane for leaf scalars
- digest format `sha256:<64hex>`

## Top-level keyset (exact)

- `v`
- `authority`
- `left_world_graph_digest`
- `right_world_graph_digest`
- `strategy`
- `relations`
- `conflicts`
- `summary`
- `digest`

Rules:

- `v` MUST be `wave21.world_merge.v0`
- `authority` MUST be `advisory`
- `digest` MUST be sha256 of canonical JSON without `digest`

## Strategy enum

- `lexicographic`
- `left_preferred`
- `right_preferred`

## `relations[]`

Merged relation list (same relation keyset as `wave19.world_graph.v0.relations[]`), sorted by `relation_id`.

## `conflicts[]` keyset (exact)

- `relation_id`
- `left_digest`
- `right_digest`
- `resolution`

`resolution` enum:

- `left`
- `right`
- `lexicographic`

## `summary` keyset (exact)

- `left_relation_count`
- `right_relation_count`
- `merged_relation_count`
- `conflict_count`

All values are decimal strings.

## Determinism Rule

For identical `relation_id` values with differing payloads, resolver is strategy-driven and deterministic.

For `lexicographic`, choose the relation with lexicographically smaller canonical JSON bytes.

## Reject Rules (minimum)

Reject on:

- invalid input world-graph version/keyset/digest
- unknown strategy
- non-string leaf values
- malformed conflict records
- summary mismatch
- digest mismatch
