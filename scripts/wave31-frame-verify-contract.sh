#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SURFACE="dev-docs/wave30/evidence-surface.chords.v0.json"
EMITTER="dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson"

bash scripts/wave31-esp32-decode-roundtrip.sh

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

expect_fail_none() {
  local bin="$1"
  if node tools/mv-evidence-surface/index.js wave31-verify \
    --surface "$SURFACE" \
    --emitter "$EMITTER" \
    --uart-crc none \
    --in-bin "$bin" \
    --receipt-out "$TMP_DIR/receipt.json" \
    --verify-out "$TMP_DIR/verify.json" >/dev/null 2>&1; then
    echo "ERROR: expected failure for $bin" >&2
    exit 2
  fi
}

expect_fail_crc() {
  local bin="$1"
  if node tools/mv-evidence-surface/index.js wave31-verify \
    --surface "$SURFACE" \
    --emitter "$EMITTER" \
    --uart-crc crc8-xor-v0 \
    --in-bin "$bin" \
    --receipt-out "$TMP_DIR/receipt.json" \
    --verify-out "$TMP_DIR/verify.json" >/dev/null 2>&1; then
    echo "ERROR: expected failure for $bin (crc mode)" >&2
    exit 2
  fi
}

expect_fail_none "dev-docs/wave31/must-reject/truncated.bin"
expect_fail_none "dev-docs/wave31/must-reject/trailing-garbage.bin"
expect_fail_none "dev-docs/wave31/must-reject/bad-header.bin"
expect_fail_none "dev-docs/wave31/must-reject/wrong-length.bin"
expect_fail_none "dev-docs/wave31/must-reject/reordered.bin"
expect_fail_crc "dev-docs/wave31/must-reject/crc-mismatch.bin"

echo "ok wave31 frame verify contract"
