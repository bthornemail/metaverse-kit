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

expect_fail "truncated packet" "framing mismatch" \
  node tools/mv-evidence-surface/index.js decode-esp32-uart \
    --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none \
    --in-bin "$MR/bad-uart-decode-truncated.bin" --out /tmp/wave30.decode.reject1.ndjson

expect_fail "extra trailing bytes" "framing mismatch" \
  node tools/mv-evidence-surface/index.js decode-esp32-uart \
    --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none \
    --in-bin "$MR/bad-uart-decode-extra.bin" --out /tmp/wave30.decode.reject2.ndjson

expect_fail "crc mismatch" "crc mismatch" \
  node tools/mv-evidence-surface/index.js decode-esp32-uart \
    --surface "$SURFACE" --emitter "$EMITTER" --uart-crc crc8-xor-v0 \
    --in-bin "$MR/bad-uart-decode-crc.bin" --out /tmp/wave30.decode.reject3.ndjson

expect_fail "illegal enum/version byte" "version byte mismatch" \
  node tools/mv-evidence-surface/index.js decode-esp32-uart \
    --surface "$SURFACE" --emitter "$EMITTER" --uart-crc none \
    --in-bin "$MR/bad-uart-decode-version.bin" --out /tmp/wave30.decode.reject4.ndjson

echo "ok wave30 uart decode must-reject"
