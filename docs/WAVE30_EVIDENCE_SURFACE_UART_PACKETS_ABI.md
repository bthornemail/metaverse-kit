# WAVE30 Evidence Surface UART Packets ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: define deterministic fixed-size UART packet records derived from Wave30 emitter frames for ESP32 transport.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`
- NDJSON is one canonical JSON object per line, newline-terminated

## Packet Type

Type: `wave30.evidence_surface_uart_packet.esp32.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `t`
- `profile`
- `uart_crc`
- `packet_bytes`
- `packet_hex`
- `frame_digest`
- `surface_digest`
- `digest`

Rules:

- `v` must be `wave30.evidence_surface_uart_packet.esp32.v0`
- `authority` must be `advisory`
- `t` is decimal string integer `0..N`
- `profile` must be `esp32.uart.v0`
- `uart_crc` must be `none` or `crc8-xor-v0`
- `packet_bytes` must be `67` when `uart_crc=none`
- `packet_bytes` must be `68` when `uart_crc=crc8-xor-v0`
- `packet_hex` must be lowercase hex and length `134`
- `frame_digest` must match corresponding `wave30.evidence_surface_emitter_frame.esp32.v0` digest
- `surface_digest` must equal digest of input `wave30.evidence_surface.chords.v0`
- `digest` must match canonical payload hash without `digest`

## Fixed Binary Layout

Packet bytes are fixed to `67` bytes:

- byte `0`: `0x30` (wave30 transport version)
- byte `1`: `0x01` (esp32 profile marker)
- bytes `2..3`: `t` modulo `65536`, big-endian
- bytes `4..5`: `frame_ms` modulo `65536`, big-endian
- byte `6`: pointer index (`0..239`) or `0xFF` when unset
- bytes `7..36`: `on` mask, 240 bits (30 bytes), bit `i` => LED `i`
- bytes `37..66`: `dim` mask, 240 bits (30 bytes), bit `i` => LED `i`
- optional byte `67`: CRC byte when `uart_crc=crc8-xor-v0`

## Deterministic Mapping

For each emitter frame:

- `packet_hex` is the exact hex encoding of the fixed binary layout above
- `frame_digest` is copied from emitter frame digest
- one packet is emitted per emitter frame with matching `t`
- optional `.bin` projection is `concat(packet_bytes in ascending t order)`
- when `uart_crc=crc8-xor-v0`, CRC byte is XOR of bytes `0..66`

No additional semantics are introduced.

## Must-Reject

Reject on:

- unknown/missing keys
- authority not `advisory`
- malformed digest fields
- non-string leaves
- wrong `profile` or `packet_bytes`
- non-hex or wrong-length `packet_hex`
- `surface_digest` mismatch
- `frame_digest` mismatch against emitter input
- digest mismatch
- packet recompute mismatch
