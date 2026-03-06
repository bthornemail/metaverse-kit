# WAVE31 Device Parity Harness

Status: experimental advisory parity harness plan.

Authority class: `advisory`.

Purpose: freeze the device-side parity contract for Wave31 without introducing firmware implementation semantics.

## Scope

This document is plan-only scaffolding for future ESP32/device implementation lanes.

It does not add protocol semantics beyond existing ABIs:

- `wave31.hardware_decode_receipt.v0`
- `wave31.frame_verify_result.v0`
- `wave30.evidence_surface_uart_packet.esp32.v0`

## Frozen IDs Referenced

- `decode_profile_id = "wave31.decode_profile.esp32_uart.v0"`
- `frame_verify_id = "wave31.frame_verify.leds240.v0"`
- `frame_type = "wave30.evidence_surface_emitter_frame.esp32.v0"`
- `uart_crc = "none" | "crc8-xor-v0"`

## Device Input Contract

Device input is UART packet bytes conforming to Wave30 UART packets ABI:

- fixed profile markers
- fixed packet sizing by CRC mode
- deterministic packet ordering by `t`
- no trailing bytes after packet boundary

## Device Output Contract

Device parity output must be canonical JSON artifacts that match host reference semantics exactly:

1. `wave31.hardware_decode_receipt.v0`
2. `wave31.frame_verify_result.v0`

Both outputs remain `authority: advisory`.

## Parity Rule

For each golden corpus input, device outputs must be digest-identical to host reference outputs:

- same `packet_stream_digest`
- same `frame_stream_digest`
- same artifact `digest`

If digest parity fails, parity fails.

## Fail-Closed Reject Classes

Device implementation must fail closed on these classes:

- truncated packet stream
- trailing bytes after final packet boundary
- invalid transport marker/header bytes
- invalid packet length/framing
- CRC mismatch when `uart_crc=crc8-xor-v0`
- reordered packet stream (`t` sequence mismatch)

## I/O Channel Contract (Frozen Abstract Form)

Device must expose a deterministic channel that emits canonical artifact JSON for the two Wave31 outputs.

Concrete transport mechanism is deferred (serial reverse channel, USB serial dump, file dump, etc.), but payload format is frozen to canonical JSON artifact objects.

## CI Plan

Current CI remains host-only and enforces:

- `check:wave31-doc-freeze`
- `check:wave31-esp32-decode-roundtrip`
- `check:wave31-frame-verify-contract`
- `check:wave31-device-parity-plan`

Future hardware-in-loop CI will add device parity execution against the same golden and must-reject corpora.
