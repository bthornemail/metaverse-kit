# Wave31 Device Parity Harness Shape

This folder defines future hardware-in-loop scaffolding shape only.

No firmware code is included in this lane.

## Planned layout

- `hil/`: hardware-in-loop runner scripts
- `sim/`: optional byte-level simulator runner
- `fixtures/`: copied/derived golden and must-reject UART binaries for device tests

## Planned environment variables

- `W31_DEVICE_PORT` serial device path (for example `/dev/ttyUSB0`)
- `W31_DEVICE_BAUD` serial baud rate (for example `115200`)
- `W31_DEVICE_TIMEOUT_MS` device response timeout

## Planned parity check

For each golden UART input:

1. feed bytes to device
2. capture device-emitted canonical artifacts
3. compare output digests with host reference digests from `dev-docs/wave31/golden`

Must-reject corpus requires fail-closed behavior per `docs/WAVE31_DEVICE_PARITY_HARNESS.md`.
