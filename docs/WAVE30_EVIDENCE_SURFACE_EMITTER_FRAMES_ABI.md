# WAVE30 Evidence Surface Emitter Frames ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: define deterministic NDJSON emitter frames for `leds240` hardware transport derived from canonical Wave30 surface frames.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`
- NDJSON is one canonical JSON object per line, newline-terminated

## Frame Type

Type: `wave30.evidence_surface_emitter_frame.esp32.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `t`
- `mode`
- `profile`
- `ring_size`
- `frame_ms`
- `on`
- `dim`
- `pointer`
- `surface_digest`
- `digest`

Rules:

- `v` must be `wave30.evidence_surface_emitter_frame.esp32.v0`
- `authority` must be `advisory`
- `t` is decimal string integer `0..N`
- `mode` must be `leds240`
- `profile` must be `esp32.v0`
- `ring_size` must be `240`
- `frame_ms` must be decimal string integer `1..5000`
- `on`, `dim`, `pointer` are arrays of string indices in `0..239`
- arrays must be sorted ascending and contain no duplicates
- `pointer` length must be `0..1`
- `pointer` must be subset of `on`
- `on` and `dim` must be disjoint
- `surface_digest` must equal digest of input `wave30.evidence_surface.chords.v0`
- `digest` must match canonical payload hash without `digest`

## Deterministic Mapping

Emitter frames are projection-only transport from canonical Wave30 frames:

- `on = sort(unique(pointer_on ∪ chord_on))`
- `dim = sort(chord_dim - on)`
- `pointer = pointer_on`

No additional semantics are introduced.

## Must-Reject

Reject on:

- unknown/missing keys
- authority not `advisory`
- malformed digest fields
- non-string leaves
- wrong `mode`, `profile`, or `ring_size`
- invalid `frame_ms`
- out-of-range indices
- unsorted/duplicate arrays
- `pointer` not subset of `on`
- `on` intersects `dim`
- `surface_digest` mismatch
- digest mismatch
- frame recompute mismatch
