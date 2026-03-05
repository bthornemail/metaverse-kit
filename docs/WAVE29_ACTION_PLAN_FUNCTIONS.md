# WAVE29 Action Plan Functions

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: freeze deterministic mapping from verified Wave28 (and optional Wave17/Wave27 evidence) into advisory Wave20 action plans.

## Frozen IDs

- `plan_map_id = "wave29.plan_map.poly_to_wave20.v0"`
- `plan_norm_id = "wave29.plan_norm.step_lex.v0"`

Unknown IDs must reject.

## Deterministic Mapping

Inputs:

- required: `wave28.signal_poly_projection.v0`
- optional: `wave28.poly_decomp.v0`
- optional: `wave17.merge_review.v0`
- optional: `wave27.pointer_sync_residual.v0`

Algorithm (`wave29.plan_map.poly_to_wave20.v0`):

1. Parse `input_poly` from Wave28 projection using canonical polynomial grammar (Wave28 basis ABI).
2. Let `terms` be canonical monomials in the order provided by canonical parse.
3. For each term at index `i` (0-based), compute:
   - `step = decimal string of i+1`
   - `degree = number of variables in term`
   - `bitmask = 6-bit mask string from term`
   - `verb = "TRACE_LINEAGE"` when `degree >= 3`, else `"FOCUS_CLUSTER"`
   - `target = term`
4. Build `params` keyset exactly:
   - `bitmask`
   - `degree`
   - `source_poly`
   - `target`
5. Build `evidence` as deterministic list sorted by `role` then `digest`:
   - always include `{role:"projection", digest:<projection.digest>}`
   - include `{role:"poly_decomp", digest:<decomp.digest>}` when decomp provided
   - include `{role:"merge_review", digest:<merge_review.digest>}` when merge-review provided
   - include `{role:"pointer_residual", digest:<residual.digest>}` when residual provided
6. Action list ordering is fixed by `step` ascending; this is `wave29.plan_norm.step_lex.v0`.

## Deterministic Notes

`notes` is optional but when present must be deterministic and sorted lexicographically by `code`.

Emit note entries only from fixed triggers:

- `code = "merge_review_conflicts"` if merge-review `summary.conflict_count` is non-zero
- `code = "poly_residual_nonzero"` if decomp `residual_poly != "0"`
- `code = "pointer_residual_present"` if residual artifact provided

Note keyset (exact):

- `code`
- `detail`

## Non-Authority Rule

Wave29 does not execute actions and does not mutate canonical artifacts.

If mapping cannot proceed deterministically, emit no action and fail-closed validation.
