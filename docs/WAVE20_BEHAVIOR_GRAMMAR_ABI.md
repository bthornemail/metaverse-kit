# WAVE20 Behavior Grammar ABI

Status: bootstrap freeze (graph behavior grammar, projection-only).

## Purpose

`wave20.behavior_grammar.v0` defines deterministic structural behavior rules over `wave19.world_graph.v0`.

Rules describe navigation/highlighting/proposal surfaces only. They do not mutate canonical state.

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
- `base_world_graph_digest`
- `rules`
- `summary`
- `digest`

Rules:

- `v` MUST be `wave20.behavior_grammar.v0`
- `authority` MUST be `advisory`
- `digest` MUST be sha256 of canonical JSON without `digest`

## `rules[]` keyset (exact)

- `rule_id`
- `verb`
- `source_node`
- `target_node`
- `condition`
- `effect`
- `stance`

Rules:

- `rule_id`, `source_node`, `target_node` MUST be `sha256:<64hex>`
- `source_node` and `target_node` MUST resolve to nodes in `world_graph.relations`
- `rules` MUST be sorted by `rule_id`

`verb` enum:

- `RELATE`
- `UNRELATE`
- `FOCUS_CLUSTER`
- `TRACE_LINEAGE`

`condition` enum:

- `always`
- `same_stance`
- `adjacent_only`

`effect` enum:

- `highlight`
- `trace`
- `cluster`
- `propose_relation`
- `propose_unrelation`

`stance` enum:

- `neutral`
- `solon`
- `solomon`
- `asabiyyah`
- `metatron`

## `summary` keyset (exact)

- `rule_count`
- `unique_node_count`

All values are decimal strings.

## Non-authority Rule

- Behavior grammar is advisory.
- Runtimes MUST NOT treat behavior rules as canonical mutation authority.
- Any state change must be emitted as explicit proposal artifacts.

## Reject Rules (minimum)

Reject on:

- unknown or missing keys
- unresolved node references
- duplicate `rule_id`
- invalid enum values
- non-string leaf values
- summary mismatch
- digest mismatch
