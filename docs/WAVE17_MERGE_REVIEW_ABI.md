# WAVE17 Merge Review ABI

Status: branch freeze (Path B / B.3).

## Purpose

`wave17.merge_review.v0` is a deterministic, advisory review packet derived from `wave17.conflict_bundle.v0`.

It is for review UX and operator inspection only.
It must never apply or mutate canonical truth.

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
- `bundle_digest`
- `groups`
- `summary`
- `render_hints`
- `digest`

Rules:

- `v` MUST be `wave17.merge_review.v0`
- `authority` MUST be `advisory`
- `bundle_digest` MUST reference a valid `wave17.conflict_bundle.v0` digest
- `digest` MUST be sha256 of canonical JSON without `digest`

## `groups[]` keyset (exact)

- `group_id`
- `kind`
- `status`
- `left`
- `right`

`group_id` MUST be prefixed with `node:` or `edge:`.
`groups[]` MUST be sorted lexicographically by `group_id`.

Allowed `kind` enum:

- `node`
- `edge`

Allowed `status` enum:

- `conflict`
- `left_only`
- `right_only`

`left` and `right` keyset (exact):

- `id`
- `kind`
- `value`
- `from`
- `to`
- `label`
- `direction`

All side fields are strings; empty string allowed where not applicable.

## `summary` keyset (exact)

- `group_count`
- `conflict_count`
- `left_only_count`
- `right_only_count`
- `non_conflict_count`

All values are decimal strings and MUST match computed totals from `groups[]`.

## `render_hints` keyset (exact)

- `default_group`
- `sort_order`
- `view_mode`

Required values:

- `default_group = conflict`
- `sort_order = group_id_lexicographic`
- `view_mode = advisory_review`

## Advisory-only fence

Forbidden field names anywhere in payload:

- `apply`
- `commit`
- `final`
- `merge_applied`
- `truth`
- `world`
- `world_state`

Reject if any forbidden field appears.

## Reject Rules (minimum)

Reject on:

- unknown or missing keys anywhere in artifact
- non-string leaf values (string membrane violation)
- malformed digest fields
- unsorted `groups[]`
- summary mismatch
- digest mismatch
- advisory-only fence violation
