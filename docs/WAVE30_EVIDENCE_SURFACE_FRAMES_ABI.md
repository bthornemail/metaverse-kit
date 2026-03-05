# WAVE30 Evidence Surface Frames ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: define deterministic NDJSON frame output for 240-ring LED evidence surfaces derived from canonical Wave30 chords.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`
- NDJSON is one canonical JSON object per line, newline-terminated

## Frame Type

Type: `wave30.evidence_surface_frame.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `t`
- `ring_size`
- `mode`
- `pointer_on`
- `chord_on`
- `chord_dim`
- `surface_digest`
- `digest`

Rules:

- `v` must be `wave30.evidence_surface_frame.v0`
- `authority` must be `advisory`
- `t` is decimal string integer `0..N`
- `ring_size` must be `240`
- `mode` must be `leds240`
- `pointer_on` is array of string indices in `0..239` (length 0 or 1)
- `chord_on` is array of string indices in `0..239`
- `chord_dim` is array of string indices in `0..239`
- arrays must be sorted ascending and contain no duplicates
- `chord_on` and `chord_dim` must be disjoint
- `surface_digest` must equal digest of input `wave30.evidence_surface.chords.v0`
- `digest` must match canonical payload hash without `digest`

Pointer precedence rule:

- `pointer_on` may overlap chord indices and has highest visual precedence.

## Deterministic Frame Schedule

Frozen schedule over canonical chords:

- for frame `t`, active chord index `k = (t mod k_max) + 1`
- `chord_on` = endpoints of chord `k`
- `chord_dim` = endpoints of chord `k-1` for `t>0`, else empty

Pointer source:

- optional pointer-trace input (Wave27 `p_after` replay)
- fallback deterministic ticker: `(p0 + t) mod 240`

## Must-Reject

Reject on:

- unknown/missing keys
- authority not `advisory`
- malformed digest fields
- non-string leaves
- wrong `ring_size` or `mode`
- out-of-range indices
- unsorted/duplicate arrays
- `chord_on` intersects `chord_dim`
- `surface_digest` mismatch
- digest mismatch
- frame recompute mismatch
