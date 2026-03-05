#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SURFACE="dev-docs/wave30/evidence-surface.chords.v0.json"
EMITTER="dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson"
MR="dev-docs/wave30/must-reject"

expect_fail() {
  local label="$1"
  local needle="$2"
  shift 2
  set +e
  local out
  out="$($@ 2>&1)"
  local code=$?
  set -e
  if [[ $code -eq 0 ]]; then
    echo "ERROR: expected failure for $label" >&2
    exit 2
  fi
  grep -Fq "$needle" <<<"$out" || {
    echo "ERROR: missing reject marker for $label: $needle" >&2
    echo "$out" >&2
    exit 2
  }
}

expect_fail "packet length" "length mismatch" \
  node tools/mv-evidence-surface/index.js verify-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none --in "$MR/bad-uart-packet-len.ndjson"

expect_fail "surface digest mismatch" "surface_digest mismatch" \
  node tools/mv-evidence-surface/index.js verify-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none --in "$MR/bad-uart-surface-digest.ndjson"

expect_fail "frame digest mismatch" "frame_digest mismatch" \
  node tools/mv-evidence-surface/index.js verify-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none --in "$MR/bad-uart-frame-digest.ndjson"

expect_fail "uart digest mismatch" "digest mismatch" \
  node tools/mv-evidence-surface/index.js verify-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none --in "$MR/bad-uart-digest.ndjson"

expect_fail "uart bin length mismatch" "bin length mismatch" \
  node tools/mv-evidence-surface/index.js verify-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none --in "dev-docs/wave30/evidence-surface.uart.esp32.v0.ndjson" --in-bin "$MR/bad-uart-bin-len.bin"

expect_fail "uart bin content mismatch" "bin content mismatch" \
  node tools/mv-evidence-surface/index.js verify-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none --in "dev-docs/wave30/evidence-surface.uart.esp32.v0.ndjson" --in-bin "$MR/bad-uart-bin-content.bin"

expect_fail "uart crc mismatch" "crc mismatch" \
  node tools/mv-evidence-surface/index.js verify-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc crc8-xor-v0 --in "$MR/bad-uart-crc.ndjson"

expect_fail "uart crc mode mismatch" "uart_crc mismatch" \
  node tools/mv-evidence-surface/index.js verify-esp32-uart --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none --in "dev-docs/wave30/evidence-surface.uart.esp32.crc8xor.v0.ndjson"

echo "ok wave30 uart must-reject"
