# WAVE30 Evidence Surface Chords ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: define a deterministic, replayable LED chord surface over a 240 ring derived from a frozen seed digest.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`
- arrays are allowed; all leaf scalars must be strings

## Artifact

Type: `wave30.evidence_surface.chords.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `seed_digest`
- `ring_size`
- `p0`
- `d`
- `k_max`
- `chords_digest`
- `digest`

Rules:

- `v` must be `wave30.evidence_surface.chords.v0`
- `authority` must be `advisory`
- `seed_digest` must be `sha256:<64hex>`
- `ring_size` must be `240`
- `p0` must be decimal string in `0..239`
- `d` must be decimal string in `1..119`
- `k_max` must be decimal string in `1..48`
- `(p0,d,k_max)` must match frozen extraction rule from `seed_digest`
- recomputed chord list digest must equal `chords_digest`
- `digest` must be canonical payload hash without `digest`

## Chord Canonicalization

For each `k = 1..k_max`:

- `a_k = (p0 + k*d) mod 240`
- `b_k = (p0 - k*d) mod 240`
- chord pair is unordered and serialized as `(lo,hi) = (min(a_k,b_k), max(a_k,b_k))`

Canonical chord list ordering:

- lexicographic sort by `(lo,hi)`

## Must-Reject

Reject on:

- unknown/missing keys
- authority not `advisory`
- malformed digest fields
- non-string leaves
- ring size mismatch
- out-of-range numeric fields
- extraction mismatch vs `seed_digest`
- degenerate chord (`a_k == b_k`)
- duplicate chords
- chords_digest mismatch
- digest mismatch
