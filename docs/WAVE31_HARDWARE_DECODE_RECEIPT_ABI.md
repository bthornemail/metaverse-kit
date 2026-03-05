# WAVE31 Hardware Decode Receipt ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: define a deterministic host/device decode receipt for Wave30 UART packet streams without introducing authority semantics.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`

## Frozen IDs

- `decode_profile_id = "wave31.decode_profile.esp32_uart.v0"`

## Artifact

Type: `wave31.hardware_decode_receipt.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `decode_profile_id`
- `surface_digest`
- `packet_stream_digest`
- `uart_crc`
- `packet_count`
- `decode_ok`
- `error_count`
- `first_error_code`
- `digest`

Rules:

- `v` must be `wave31.hardware_decode_receipt.v0`
- `authority` must be `advisory`
- `decode_profile_id` must be `wave31.decode_profile.esp32_uart.v0`
- `surface_digest` must reference the input `wave30.evidence_surface.chords.v0` digest
- `packet_stream_digest` must reference canonical NDJSON digest of decoded `wave30.evidence_surface_uart_packet.esp32.v0` stream
- `uart_crc` must be `none` or `crc8-xor-v0`
- `packet_count` is decimal string integer `>= 0`
- `decode_ok` must be `0` or `1`
- `error_count` is decimal string integer `>= 0`
- `first_error_code` is `none` when `decode_ok=1`, otherwise a stable string code
- `digest` must match canonical payload hash without `digest`

## Must-Reject

Reject on:

- unknown/missing keys
- non-string leaves
- authority not `advisory`
- unknown `decode_profile_id`
- malformed digest fields
- `uart_crc` outside allowed enum
- `decode_ok=1` with `error_count != 0`
- `decode_ok=1` with `first_error_code != none`
- digest mismatch
