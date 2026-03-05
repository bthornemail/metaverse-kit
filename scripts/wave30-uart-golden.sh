#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SURFACE="dev-docs/wave30/evidence-surface.chords.v0.json"
EMITTER="dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson"
GOLDEN="dev-docs/wave30/evidence-surface.uart.esp32.v0.ndjson"
GOLDEN_BIN="dev-docs/wave30/evidence-surface.uart.esp32.v0.bin"
GOLDEN_CRC="dev-docs/wave30/evidence-surface.uart.esp32.crc8xor.v0.ndjson"
GOLDEN_CRC_BIN="dev-docs/wave30/evidence-surface.uart.esp32.crc8xor.v0.bin"
TMP_A="$(mktemp)"
TMP_B="$(mktemp)"
TMP_A_BIN="$(mktemp)"
TMP_B_BIN="$(mktemp)"
TMP_C="$(mktemp)"
TMP_D="$(mktemp)"
TMP_C_BIN="$(mktemp)"
TMP_D_BIN="$(mktemp)"
trap 'rm -f "$TMP_A" "$TMP_B" "$TMP_A_BIN" "$TMP_B_BIN" "$TMP_C" "$TMP_D" "$TMP_C_BIN" "$TMP_D_BIN"' EXIT

node tools/mv-evidence-surface/index.js emit-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none --out "$TMP_A" --out-bin "$TMP_A_BIN"
node tools/mv-evidence-surface/index.js emit-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none --out "$TMP_B" --out-bin "$TMP_B_BIN"

cmp -s "$TMP_A" "$TMP_B" || { echo "ERROR: wave30 uart emit not deterministic" >&2; exit 2; }
cmp -s "$TMP_A" "$GOLDEN" || { echo "ERROR: wave30 uart golden mismatch" >&2; exit 2; }
cmp -s "$TMP_A_BIN" "$TMP_B_BIN" || { echo "ERROR: wave30 uart bin emit not deterministic" >&2; exit 2; }
cmp -s "$TMP_A_BIN" "$GOLDEN_BIN" || { echo "ERROR: wave30 uart bin golden mismatch" >&2; exit 2; }

node tools/mv-evidence-surface/index.js verify-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none --in "$TMP_A" --in-bin "$TMP_A_BIN"

node tools/mv-evidence-surface/index.js emit-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc crc8-xor-v0 --out "$TMP_C" --out-bin "$TMP_C_BIN"
node tools/mv-evidence-surface/index.js emit-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc crc8-xor-v0 --out "$TMP_D" --out-bin "$TMP_D_BIN"

cmp -s "$TMP_C" "$TMP_D" || { echo "ERROR: wave30 uart+crc emit not deterministic" >&2; exit 2; }
cmp -s "$TMP_C" "$GOLDEN_CRC" || { echo "ERROR: wave30 uart+crc golden mismatch" >&2; exit 2; }
cmp -s "$TMP_C_BIN" "$TMP_D_BIN" || { echo "ERROR: wave30 uart+crc bin emit not deterministic" >&2; exit 2; }
cmp -s "$TMP_C_BIN" "$GOLDEN_CRC_BIN" || { echo "ERROR: wave30 uart+crc bin golden mismatch" >&2; exit 2; }

node tools/mv-evidence-surface/index.js verify-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc crc8-xor-v0 --in "$TMP_C" --in-bin "$TMP_C_BIN"

echo "ok wave30 uart golden"
