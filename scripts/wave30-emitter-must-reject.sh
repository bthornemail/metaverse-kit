#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SURFACE="dev-docs/wave30/evidence-surface.chords.v0.json"
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

expect_fail "profile mismatch" "profile mismatch" \
  node tools/mv-evidence-surface/index.js verify-leds240-esp32 --surface "$SURFACE" --frame-ms 50 --in "$MR/bad-emitter-profile.ndjson"

expect_fail "frame_ms range" "out of range" \
  node tools/mv-evidence-surface/index.js verify-leds240-esp32 --surface "$SURFACE" --frame-ms 50 --in "$MR/bad-emitter-frame-ms.ndjson"

expect_fail "on/dim overlap" "intersects" \
  node tools/mv-evidence-surface/index.js verify-leds240-esp32 --surface "$SURFACE" --frame-ms 50 --in "$MR/bad-emitter-overlap.ndjson"

expect_fail "surface digest mismatch" "surface_digest mismatch" \
  node tools/mv-evidence-surface/index.js verify-leds240-esp32 --surface "$SURFACE" --frame-ms 50 --in "$MR/bad-emitter-surface-digest.ndjson"

expect_fail "digest mismatch" "digest mismatch" \
  node tools/mv-evidence-surface/index.js verify-leds240-esp32 --surface "$SURFACE" --frame-ms 50 --in "$MR/bad-emitter-digest.ndjson"

echo "ok wave30 emitter must-reject"
