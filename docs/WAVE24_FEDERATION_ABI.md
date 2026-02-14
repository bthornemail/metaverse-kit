# WAVE24 Federation Closure ABI

Status: closure merge algebra (deterministic world federation).

## Purpose

`wave24.federation_merge_result.v0` deterministically merges two `wave19.world_graph.v0` artifacts.

This artifact is advisory and does not introduce authority.

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
- `strategy`
- `left_digest`
- `right_digest`
- `merged_digest`
- `merged_relations`
- `rejected_components`
- `conflict_summary`
- `digest`

Rules:

- `v` MUST be `wave24.federation_merge_result.v0`
- `authority` MUST be `advisory`
- `strategy` enum: `lexicographic|left_preferred|right_preferred`
- `digest` MUST be sha256 of canonical JSON without `digest`

## Compatibility Predicate

`C(W1, W2)` rejects when:

- world graph versions differ
- base world-entities digests differ
- relation keysets are invalid

## `conflict_summary[]` keyset (exact)

- `relation_id`
- `left_relation_digest`
- `right_relation_digest`
- `resolution`

`resolution` enum: `left|right|lexicographic`

## Merge Rules

- relation sets merge by `relation_id`
- non-overlapping relations are unioned
- overlaps resolve deterministically by strategy
- unresolved deterministic conditions MUST reject

## Reject Rules (minimum)

Reject on:

- incompatible inputs
- unknown strategy
- non-string leaf values
- malformed conflict summary
- digest mismatch
