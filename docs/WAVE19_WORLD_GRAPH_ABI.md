# WAVE19.2 World Graph ABI

Status: bootstrap freeze (entity relations, projection-only).

## Purpose

`wave19.world_graph.v0` adds deterministic relation structure over `wave19.world_entities.v0` nodes.

This artifact is advisory and does not mutate canonical truth.

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
- `base_world_entities_digest`
- `relations`
- `summary`
- `digest`

Rules:

- `v` MUST be `wave19.world_graph.v0`
- `authority` MUST be `advisory`
- `digest` MUST be sha256 of canonical JSON without `digest`

## `relations[]` keyset (exact)

- `relation_id`
- `source_node`
- `target_node`
- `relation_type`
- `weight`
- `stance`

Rules:

- `relation_id`, `source_node`, `target_node` MUST be `sha256:<64hex>`
- `source_node` and `target_node` MUST resolve to `world_entities.entities[].node_id`
- `relations` MUST be sorted by `relation_id`
- `weight` MUST be decimal string (signed/unsigned integer)

`relation_type` enum:

- `influences`
- `contains`
- `observes`
- `delegates`
- `adjacent_to`
- `mirrors`

`stance` enum:

- `neutral`
- `solon`
- `solomon`
- `asabiyyah`
- `metatron`

## `summary` keyset (exact)

- `relation_count`
- `unique_node_count`

All values are decimal strings.

## Reject Rules (minimum)

Reject on:

- unknown or missing keys
- unresolved node references
- duplicate `relation_id`
- invalid enums
- non-string leaf values
- summary mismatch
- digest mismatch
