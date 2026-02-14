# WAVE18 Avatar Role ABI

Status: branch freeze (role + capability contract).

## Purpose

`wave18.avatar_role.v0` defines semantic actor roles as permission structures.

Roles are advisory interfaces over interaction/proposal flows and do not directly grant canonical mutation rights.

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
- `role_id`
- `label`
- `domain`
- `allowed_verbs`
- `generator_permissions`
- `dialogue_profile`
- `constraints`
- `digest`

Rules:

- `v` MUST be `wave18.avatar_role.v0`
- `authority` MUST be `advisory`
- `digest` MUST be sha256 of canonical JSON without `digest`

## Domain enum

- `law`
- `wisdom`
- `cohesion`
- `covenant`

## `allowed_verbs`

Array of interaction verbs allowed for this role.

All verbs must resolve to known interaction grammar entries.

## `generator_permissions`

Array of allowed generator IDs for role.

## `dialogue_profile` keyset (exact)

- `style`
- `priority`
- `requires_citation`

## `constraints` keyset (exact)

- `can_emit_proposals`
- `can_approve_merges`
- `can_override_constitution`

Values are `"0"` or `"1"` strings.

## Starter Roles (reference set)

- Solon (`domain=law`)
- Solomon (`domain=wisdom`)
- Asabiyyah (`domain=cohesion`)
- Metatron (`domain=covenant`)

## Reject Rules (minimum)

Reject on:

- unknown/missing keys
- unknown domain
- unknown interaction verb reference
- invalid 0/1 constraint values
- digest mismatch
