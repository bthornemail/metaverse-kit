# WAVE28 Zero Poly Basis ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: define a deterministic F2 polynomial basis for advisory decomposition.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`
- arrays are allowed; all leaf scalars must be strings

## Artifact

Type: `wave28.zero_poly_basis.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `field`
- `variables`
- `basis`
- `basis_order`
- `digest`

Rules:

- `v` must be `wave28.zero_poly_basis.v0`
- `authority` must be `advisory`
- `field` must be `F2`
- `variables` is a non-empty array of unique strings
- `basis` is a non-empty array of unique canonical polynomial strings
- `basis_order` is a non-empty array of unique canonical polynomial strings
- `basis_order` must equal `basis` in v0
- `digest` must match canonical payload hash without `digest`

## Polynomial Canonical Form (v0)

- Variable tokens: `x1..x6`
- Constants: `0` and `1`
- Operators: `+` and `*` only
- Parentheses are not allowed in v0
- Monomial grammar:
  - `1` OR `xN(*xM)*` where variable indices are strictly increasing and unique
- Polynomial grammar:
  - `0` for empty polynomial
  - OR `monomial(+monomial)*`
- Canonical term ordering:
  - terms are unique
  - terms are sorted lexicographically by their 6-bit monomial mask (`x1..x6` bit order)
- Coefficients are implicitly F2 (`0|1`) via term presence

## Must-Reject

Reject on:

- unknown/missing keys
- non-string leaves
- `field != F2`
- non-canonical polynomial strings
- duplicate variables/terms
- `basis_order` not exactly equal to `basis`
- digest mismatch
- authority not `advisory`
