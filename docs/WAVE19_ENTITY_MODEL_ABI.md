# WAVE19 Entity Model ABI

Status: bootstrap freeze (entity IR primitive).

## Purpose

`wave19.entity_model.v0` defines a projection-safe entity artifact.

Entities are canonical IR objects consumed by adapters. Renderers remain non-authoritative.

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
- `entity_id`
- `type`
- `ontology_role`
- `state`
- `assets`
- `behaviors`
- `permissions`
- `digest`

Rules:

- `v` MUST be `wave19.entity_model.v0`
- `authority` MUST be `advisory`
- `digest` MUST be sha256 of canonical JSON without `digest`

## Type enum

- `avatar`
- `object`
- `place`
- `process`

## `assets[]` keyset (exact)

- `digest`
- `kind`
- `role`

`kind` enum:

- `md`
- `json`
- `png`
- `gltf`
- `wav`
- `mp3`
- `bin`

`role` enum:

- `visual`
- `audio`
- `logic`
- `doc`
- `data`

## `behaviors` keyset (exact)

- `allowed_verbs`
- `event_source`

`event_source` enum:

- `interaction_tape`
- `shared_tape`
- `dialogue_grammar`

## `permissions` keyset (exact)

- `can_emit_proposals`
- `can_mutate_canonical`

Values are string booleans (`"0"|"1"`).

`can_mutate_canonical` MUST be `"0"`.

## Reject Rules (minimum)

Reject on:

- unknown or missing keys
- non-string leaf values
- unknown type / enums
- unknown interaction verb reference
- invalid `0|1` permission values
- `can_mutate_canonical != "0"`
- digest mismatch
