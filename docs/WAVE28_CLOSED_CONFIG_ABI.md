# WAVE28 Closed Config ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: freeze deterministic closed-configuration references and matrix non-degeneracy output.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`
- arrays are allowed; all leaf scalars must be strings

## Deterministic Matrix Rule

Frozen IDs:

- `matrix_layout_id = "wave28.matrix_layout.core6.v0"`

Layout rule:

- row/column order is fixed to `x1..x6`
- matrix values are F2 bits (`0|1`)
- matrix serialization for digesting is deterministic and canonical

Input references are typed artifacts in v0:

- `constraints_digest` must reference `wave28.constraints.v0`
- `carrier_state_digest` must reference `wave28.carrier_state.v0`

`wave28.constraints.v0` keyset:

- `v`
- `authority`
- `matrix_layout_id`
- `row_masks` (array of six `0|1` bitstrings of length 6)
- `digest`

`wave28.carrier_state.v0` keyset:

- `v`
- `authority`
- `carrier_bits` (single bitstring length 6)
- `digest`

## Artifact

Type: `wave28.closed_config.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `basis_digest`
- `constraints_digest`
- `carrier_state_digest`
- `matrix_layout_id`
- `matrix_digest`
- `non_degenerate`
- `digest`

Rules:

- `v` must be `wave28.closed_config.v0`
- `authority` must be `advisory`
- digest references must match `sha256:<64hex>`
- `matrix_layout_id` must be `wave28.matrix_layout.core6.v0`
- `non_degenerate` is bit string `0|1`
- `digest` must match canonical payload hash without `digest`

## Must-Reject

Reject on:

- unknown/missing keys
- non-string leaves
- malformed digest fields
- unknown matrix layout id
- invalid `non_degenerate`
- digest mismatch
- authority not `advisory`
