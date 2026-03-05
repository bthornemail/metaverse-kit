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

expect_fail "bad mode" "mode mismatch" \
  node tools/mv-evidence-surface/index.js verify-leds240 --surface "$SURFACE" --in "$MR/bad-frame-mode.ndjson"

expect_fail "out of range" "out of range" \
  node tools/mv-evidence-surface/index.js verify-leds240 --surface "$SURFACE" --in "$MR/bad-frame-out-of-range.ndjson"

expect_fail "unsorted" "must be sorted ascending" \
  node tools/mv-evidence-surface/index.js verify-leds240 --surface "$SURFACE" --in "$MR/bad-frame-unsorted.ndjson"

expect_fail "overlap" "intersects" \
  node tools/mv-evidence-surface/index.js verify-leds240 --surface "$SURFACE" --in "$MR/bad-frame-overlap.ndjson"

expect_fail "surface digest" "surface_digest mismatch" \
  node tools/mv-evidence-surface/index.js verify-leds240 --surface "$SURFACE" --in "$MR/bad-frame-surface-digest.ndjson"

expect_fail "frame digest" "digest mismatch" \
  node tools/mv-evidence-surface/index.js verify-leds240 --surface "$SURFACE" --in "$MR/bad-frame-digest.ndjson"

echo "ok wave30 frames must-reject"
