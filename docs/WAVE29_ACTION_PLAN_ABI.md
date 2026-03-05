# WAVE29 Action Plan ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: define deterministic, replay-verifiable advisory action plans derived from verified artifacts.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`
- arrays are allowed; all leaf scalars must be strings

## Function Binding (required)

- `plan_map_id` must be `wave29.plan_map.poly_to_wave20.v0`
- `plan_norm_id` must be `wave29.plan_norm.step_lex.v0`

Function semantics are frozen in:

- `docs/WAVE29_ACTION_PLAN_FUNCTIONS.md`

## Artifact

Type: `wave29.action_plan.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `plan_map_id`
- `plan_norm_id`
- `inputs`
- `actions`
- `notes`
- `digest`

Rules:

- `v` must be `wave29.action_plan.v0`
- `authority` must be `advisory`
- `inputs` is non-empty array of `{v,digest}` refs sorted by `v`, then `digest`
- `actions` is non-empty array sorted by `step` numeric ascending
- `notes` is array sorted by `code` lexicographically (empty array allowed)
- `digest` must match canonical payload hash without `digest`

## `inputs[]` keyset (exact)

- `v`
- `digest`

Rules:

- `v` must be one of:
  - `wave28.signal_poly_projection.v0`
  - `wave28.poly_decomp.v0`
  - `wave17.merge_review.v0`
  - `wave27.pointer_sync_residual.v0`
- `digest` must be `sha256:<64hex>`

## `actions[]` keyset (exact)

- `step`
- `verb`
- `params`
- `evidence`

Rules:

- `step` is decimal string >= 1
- `verb` enum (Wave20):
  - `FOCUS_CLUSTER`
  - `TRACE_LINEAGE`
- `input_poly` and `residual_poly` use canonical polynomial format from Wave28 basis ABI
- `params` keyset (exact):
  - `bitmask`
  - `degree`
  - `source_poly`
  - `target`
- `evidence` is array of `{role,digest}` sorted by `role`, then `digest`

## `notes[]` keyset (exact)

- `code`
- `detail`

## Must-Reject

Reject on:

- unknown/missing keys
- unknown map/norm IDs
- authority not `advisory`
- malformed digest fields
- non-string leaves
- invalid `inputs` ordering or unknown input types
- invalid `actions` ordering or invalid step sequence
- invalid verb enum values
- invalid `params` keyset
- invalid `notes` ordering
- digest mismatch
- recompute mismatch against frozen mapping function
