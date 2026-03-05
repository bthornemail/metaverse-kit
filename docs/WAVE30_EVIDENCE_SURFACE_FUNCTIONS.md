# WAVE30 Evidence Surface Functions

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: freeze deterministic seed extraction and chord derivation for `wave30.evidence_surface.chords.v0`.

## Frozen IDs

- `surface_map_id = "wave30.surface_map.digest_to_chords.v0"`
- `surface_norm_id = "wave30.surface_norm.chord_lex.v0"`

Unknown IDs must reject.

## Seed Rule

- `seed_digest = wave30.evidence_bundle.v0.digest`

## Extraction Rule (frozen)

Given digest bytes `b0,b1,b2` from `seed_digest`:

- `p0 = b0 mod 240`
- `d0 = 1 + 2*(b1 mod 60)`
- `d` is the first odd value in sequence `d0, d0+2, d0+4, ...` (wrapping in `1..119`) such that `gcd(d,240)=1`
- `k_max = 1 + (b2 mod 48)`

All operations are integer-only.

## Chord Rule

For `k = 1..k_max`:

- `a_k = (p0 + k*d) mod 240`
- `b_k = (p0 - k*d) mod 240`
- canonical pair `(lo,hi) = (min(a_k,b_k), max(a_k,b_k))`

Canonical list sorting:

- lexicographic by `(lo,hi)` (`wave30.surface_norm.chord_lex.v0`)

## Renderer Rule

Spiral rendering is projection-only and non-canonical.

- canonical truth: chord list derived from `(p0,d,k_max)`
- spiral output: deterministic renderer view over canonical chords
