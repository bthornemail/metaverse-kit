# WAVE30 to world.ir.v0 Mapping

Status: frozen implementation mapping for governed runtime handoff.

Authority posture:

- Input Wave30 and Wave31 artifacts remain `authority: advisory`.
- authority: `advisory`
- Output `world.ir.v0` is a governed handoff/projection artifact, not protocol authority.
- Wave31 verification digests are verification-only metadata and must not be used as authority-bearing runtime input.

## Command

- `build-world-ir-wave30` in `tools/mv-runtime-handoff/index.js`

Required inputs:

- `wave30.evidence_surface.chords.v0` (`--surface`)
- `wave30.evidence_surface_frame.v0` NDJSON (`--frames`)

Optional inputs:

- `wave30.evidence_bundle.v0` (`--bundle`)
- `wave30.evidence_surface_emitter_frame.esp32.v0` NDJSON (`--emitter`)
- `wave30.evidence_surface_uart_packet.esp32.v0` NDJSON (`--uart`, requires `--emitter`)
- `wave31.hardware_decode_receipt.v0` + `wave31.frame_verify_result.v0` (`--wave31-receipt`, `--wave31-frame-verify`)

## world.ir.v0 Output Mapping

- `world` must be `wave30-surface-v0` unless explicitly overridden with `--world`.
- `entities[]` derive deterministically from observed ring indices in frame payloads (`chord_on`, `chord_dim`, `pointer_on`).
- `components[]` are limited to:
  - projection index payload (`wave30.led.index`)
  - frame activity counters (`wave30.led.activity`)
  - runtime display-state projection (`wave30.runtime.display_state`)
- `events[]` are deterministic ordered frame projections (`frame:<t>`) with:
  - `type = wave30.frame.leds240`
  - `t`, `pointer_on`, `chord_on`, `chord_dim`
  - `surface_digest`, `frame_digest`
- `attachments[]` preserve evidence lineage refs:
  - `surface_digest`
  - `frame_stream_digest`
  - `packet_stream_digest` when UART is provided
  - bundle digest when bundle is provided
  - Wave31 receipt/verify digests as verification-only metadata

## Deterministic Ordering Rules

- Frame NDJSON order is authoritative (`t` must be contiguous starting at `0`).
- Emitter NDJSON order is authoritative and must match frame sequence.
- UART NDJSON order is authoritative and must match emitter sequence.
- World IR generation is deterministic for equal input bytes.
- Stream digests are computed from canonical NDJSON object lines with trailing newline.

## Reject Conditions (Fail Closed)

Adapter must reject on at least:

- missing required Wave30 files
- digest mismatch in any validated artifact
- unknown keys or missing keys in strict-keyset artifacts
- frame/emitter/uart sequence ordering mismatch
- `surface_digest` propagation mismatch
- malformed `world.ir.v0` structure
- undeclared semantic defaults (missing required Wave30 keys must reject)
- malformed UART packet context (for example UART provided without emitter context)
- Wave31 artifacts with non-`advisory` authority
- Wave31 receipt/verify inconsistency

## Non-Authority Rule

This mapping must not infer world law, physics, or agent/game semantics from LED transport artifacts.
It is a governed projection into `world.ir.v0` for runtime materialization only.
