# WAVE31 Frame Verify Result ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: define deterministic verification results for reconstructed Wave30 LED frame streams.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`

## Frozen IDs

- `frame_verify_id = "wave31.frame_verify.leds240.v0"`

## Artifact

Type: `wave31.frame_verify_result.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `frame_verify_id`
- `surface_digest`
- `frame_stream_digest`
- `frame_count`
- `verify_ok`
- `mismatch_count`
- `first_mismatch_t`
- `digest`

Rules:

- `v` must be `wave31.frame_verify_result.v0`
- `authority` must be `advisory`
- `frame_verify_id` must be `wave31.frame_verify.leds240.v0`
- `surface_digest` must reference the input `wave30.evidence_surface.chords.v0` digest
- `frame_stream_digest` must reference canonical NDJSON digest of compared frame stream
- `frame_count` is decimal string integer `>= 0`
- `verify_ok` must be `true` or `false` (string)
- `mismatch_count` is decimal string integer `>= 0`
- `first_mismatch_t` is `none` when `verify_ok=true`, otherwise decimal string frame index
- `digest` must match canonical payload hash without `digest`

## Must-Reject

Reject on:

- unknown/missing keys
- non-string leaves
- authority not `advisory`
- unknown `frame_verify_id`
- malformed digest fields
- `verify_ok=true` with `mismatch_count != 0`
- `verify_ok=true` with `first_mismatch_t != none`
- digest mismatch
