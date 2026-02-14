# WAVE18 Dialogue Grammar ABI

Status: branch freeze (conversation automata contract).

## Purpose

`wave18.dialogue_grammar.v0` defines legal role-to-role transitions and permitted emissions in structured dialogue.

It constrains social runtime behavior without introducing authority mutation.

## Canonical Rules

- UTF-8 JSON
- sorted keys
- compact separators
- trailing newline
- strict keysets
- string membrane
- digest format `sha256:<64hex>`

## Top-level keyset (exact)

- `v`
- `authority`
- `grammar_id`
- `roles`
- `states`
- `transitions`
- `emission_rules`
- `digest`

Rules:

- `v` MUST be `wave18.dialogue_grammar.v0`
- `authority` MUST be `advisory`
- `digest` MUST be sha256 of canonical JSON without `digest`

## `roles`

Array of role IDs (`wave18.avatar_role.v0.role_id`).

## `states[]` keyset (exact)

- `state_id`
- `label`
- `role`

## `transitions[]` keyset (exact)

- `from_state`
- `to_state`
- `verb`
- `condition`

Rules:

- `verb` must be known interaction verb.
- `condition` is a digest reference to a predicate artifact or `"always"`.

## `emission_rules[]` keyset (exact)

- `state_id`
- `allowed_artifact_types`

Allowed artifact types in 18.0 freeze:

- `wave16.interaction_tape.v0`
- `wave16.proposal_bundle.v0`
- `wave17.shared_tape.v0`

## Reject Rules (minimum)

Reject on:

- unresolved role/state references
- transition cycles violating explicit policy (if policy artifact provided)
- unknown verbs
- emission artifact types outside allowlist
- digest mismatch
