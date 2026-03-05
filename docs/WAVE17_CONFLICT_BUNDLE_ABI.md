# WAVE17 Conflict Bundle ABI

Status: branch freeze (Path B / B.2).

## Purpose

`wave17.conflict_bundle.v0` is a deterministic, advisory artifact for side-by-side world comparison.

It captures node/edge differences between two world states and may include a proposal-only recommended resolution.
It does not mutate canonical truth.

Companion review projection: `wave17.merge_review.v0` (see `docs/WAVE17_MERGE_REVIEW_ABI.md`).

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
- `left_world_digest`
- `right_world_digest`
- `node_diffs`
- `edge_diffs`
- `recommended_resolution`
- `summary`
- `digest`

Rules:

- `v` MUST be `wave17.conflict_bundle.v0`
- `authority` MUST be `advisory`
- `digest` MUST be sha256 of canonical JSON without `digest`

## `node_diffs` keyset (exact)

- `added`
- `removed`
- `changed`

`added[]` and `removed[]` keyset:

- `id`
- `kind`
- `value`

`changed[]` keyset:

- `id`
- `left_kind`
- `left_value`
- `right_kind`
- `right_value`
- `status`

`status` for changed nodes MUST be `conflict`.

## `edge_diffs` keyset (exact)

- `added`
- `removed`
- `changed`

`added[]` and `removed[]` keyset:

- `id`
- `from`
- `to`
- `label`
- `direction`

`changed[]` keyset:

- `id`
- `left_from`
- `left_to`
- `left_label`
- `left_direction`
- `right_from`
- `right_to`
- `right_label`
- `right_direction`
- `status`

`status` for changed edges MUST be `conflict`.

## `recommended_resolution` keyset (exact)

- `proposal_id`
- `strategy`
- `status`
- `note`

Allowed `strategy` enum:

- `manual_review`
- `prefer_left`
- `prefer_right`

Allowed `status` enum:

- `proposed`
- `accepted`
- `rejected`

## `summary` keyset (exact)

- `node_added`
- `node_removed`
- `node_changed`
- `edge_added`
- `edge_removed`
- `edge_changed`
- `conflict_count`

All values are decimal strings and MUST match computed diff totals.

## Reject Rules (minimum)

Reject on:

- unknown or missing keys anywhere in artifact
- non-string leaf values (string membrane violation)
- malformed digest fields
- summary mismatch
- digest mismatch
