#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SURFACE="dev-docs/wave30/evidence-surface.chords.v0.json"
EMITTER="dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson"
UART_NONE="dev-docs/wave30/evidence-surface.uart.esp32.v0.ndjson"
UART_NONE_BIN="dev-docs/wave30/evidence-surface.uart.esp32.v0.bin"
UART_CRC="dev-docs/wave30/evidence-surface.uart.esp32.crc8xor.v0.ndjson"
UART_CRC_BIN="dev-docs/wave30/evidence-surface.uart.esp32.crc8xor.v0.bin"
TMP_NONE="$(mktemp)"
TMP_CRC="$(mktemp)"
trap 'rm -f "$TMP_NONE" "$TMP_CRC"' EXIT

node tools/mv-evidence-surface/index.js decode-esp32-uart \
  --surface "$SURFACE" \
  --emitter "$EMITTER" \
  --uart-crc none \
  --in-bin "$UART_NONE_BIN" \
  --out "$TMP_NONE"

cmp -s "$TMP_NONE" "$UART_NONE" || { echo "ERROR: wave30 uart decode roundtrip mismatch (none)" >&2; exit 2; }

node tools/mv-evidence-surface/index.js decode-esp32-uart \
  --surface "$SURFACE" \
  --emitter "$EMITTER" \
  --uart-crc crc8-xor-v0 \
  --in-bin "$UART_CRC_BIN" \
  --out "$TMP_CRC"

cmp -s "$TMP_CRC" "$UART_CRC" || { echo "ERROR: wave30 uart decode roundtrip mismatch (crc8-xor-v0)" >&2; exit 2; }

echo "ok wave30 uart decode roundtrip"
