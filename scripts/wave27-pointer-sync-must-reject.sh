#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RING_BASIS="dev-docs/wave27/ring-basis.v0.json"
MUST_REJECT_DIR="dev-docs/wave27/must-reject"

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

expect_fail "unknown id" "unknown turn_clock_id" \
  node tools/mv-pointer-sync/index.js verify --in "$MUST_REJECT_DIR/bad-id.ndjson" --ring-basis "$RING_BASIS" --a-c7 0 --a-outer 010101 --b-c7 0 --b-outer 010101

expect_fail "table drift implied replay mismatch" "p_after replay mismatch" \
  node tools/mv-pointer-sync/index.js verify --in "$MUST_REJECT_DIR/bad-delta.ndjson" --ring-basis "$RING_BASIS" --a-c7 0 --a-outer 010101 --b-c7 0 --b-outer 010101

expect_fail "bad ring fingerprint" "ring_fingerprint mismatch vs ring_basis.digest" \
  node tools/mv-pointer-sync/index.js verify --in "$MUST_REJECT_DIR/bad-ring-fingerprint.ndjson" --ring-basis "$RING_BASIS" --a-c7 0 --a-outer 010101 --b-c7 0 --b-outer 010101

expect_fail "bad digest" "digest mismatch" \
  node tools/mv-pointer-sync/index.js verify --in "$MUST_REJECT_DIR/bad-digest.ndjson" --ring-basis "$RING_BASIS" --a-c7 0 --a-outer 010101 --b-c7 0 --b-outer 010101

expect_fail "bad domain" "k out of range" \
  node tools/mv-pointer-sync/index.js verify --in "$MUST_REJECT_DIR/bad-domain.ndjson" --ring-basis "$RING_BASIS" --a-c7 0 --a-outer 010101 --b-c7 0 --b-outer 010101

expect_fail "bad replay status" "status mismatch: expected fail" \
  node tools/mv-pointer-sync/index.js verify --in "$MUST_REJECT_DIR/bad-replay.ndjson" --ring-basis "$RING_BASIS" --a-c7 0 --a-outer 010101 --b-c7 0 --b-outer 011101

echo "ok wave27 pointer sync must-reject"
