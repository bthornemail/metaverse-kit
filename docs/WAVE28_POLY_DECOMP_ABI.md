# WAVE28 Poly Decomposition ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: deterministic F2 decomposition of an input polynomial over a frozen basis.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`
- arrays are allowed; all leaf scalars must be strings

## Deterministic Decomposition Rule

Frozen IDs:

- `decompose_algorithm_id = "wave28.decompose.gauss_f2.v0"`
- `norm_id = "wave28.poly_norm.bitmask_lex.v0"`

Decomposition in v0 is deterministic over `basis_order` from `wave28.zero_poly_basis.v0`.

## Artifact

Type: `wave28.poly_decomp.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `basis_digest`
- `closed_config_digest`
- `input_poly`
- `coeff_vector`
- `residual_poly`
- `norm_id`
- `digest`

Rules:

- `v` must be `wave28.poly_decomp.v0`
- `authority` must be `advisory`
- `basis_digest` and `closed_config_digest` are sha256 references
- `input_poly` and `residual_poly` use canonical polynomial format from Wave28 basis ABI
- `coeff_vector` is array of `0|1` strings aligned to `basis_order`
- `norm_id` must be `wave28.poly_norm.bitmask_lex.v0`
- `digest` must match canonical payload hash without `digest`

## Optional Future Artifacts (Not in MVP)

- `wave28.decomp_compare.v0`
- `wave28.basis_extension.v0`

These are out-of-scope for the Wave28 MVP implementation.

## Must-Reject

Reject on:

- unknown/missing keys
- non-string leaves
- malformed digest fields
- invalid polynomial strings
- coeff vector values outside `0|1`
- unknown norm/decompose ids
- digest mismatch
- replay mismatch against deterministic decomposition rule
- authority not `advisory`

Replay mismatch definition:

- recompute decomposition using `wave28.decompose.gauss_f2.v0`
- recompute `coeff_vector` and `residual_poly`
- reject on mismatch even if the artifact digest was recomputed
