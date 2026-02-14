# WAVE19.1 World Composition ABI

Status: bootstrap freeze (entity graph composition).

## Purpose

`wave19.world_entities.v0` composes `wave19.entity_model.v0` identities into a world-facing placement list.

This artifact is advisory and projection-only.

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
- `base_bundle_digest`
- `entities`
- `summary`
- `digest`

Rules:

- `v` MUST be `wave19.world_entities.v0`
- `authority` MUST be `advisory`
- `digest` MUST be sha256 of canonical JSON without `digest`

## `entities[]` keyset (exact)

- `node_id`
- `entity_digest`
- `scene_layer`
- `x`
- `y`
- `z`

Rules:

- `node_id` and `entity_digest` MUST be `sha256:<64hex>`
- `entity_digest` MUST resolve to a provided `wave19.entity_model.v0.entity_id`
- coordinates are signed decimal strings

`scene_layer` enum:

- `forum`
- `timeline`
- `inspector`
- `vr`

## `summary` keyset (exact)

- `entity_count`
- `unique_entity_digest_count`

All values are decimal strings.

## Reject Rules (minimum)

Reject on:

- unknown or missing keys
- unresolved `entity_digest`
- duplicate `node_id`
- unknown `scene_layer`
- non-string leaf values
- digest mismatch
