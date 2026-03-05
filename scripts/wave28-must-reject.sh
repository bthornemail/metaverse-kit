#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASIS="dev-docs/wave28/zero-poly-basis.v0.json"
CLOSED="dev-docs/wave28/closed-config.v0.json"
MR="dev-docs/wave28/must-reject"

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

expect_fail "bad keyset" "keyset mismatch" \
  node tools/mv-poly-basis/index.js validate --in "$MR/bad-keyset.basis.json"

expect_fail "bad authority" "authority must be advisory" \
  node tools/mv-poly-closed-config/index.js validate --in "$MR/bad-authority.closed.json" --basis "$BASIS"

expect_fail "bad field" "field must be F2" \
  node tools/mv-poly-basis/index.js validate --in "$MR/bad-field.basis.json"

expect_fail "bad digest" "digest mismatch" \
  node tools/mv-poly-decompose/index.js validate --in "$MR/bad-digest.poly-decomp.json" --basis "$BASIS" --closed "$CLOSED"

expect_fail "bad basis order" "basis_order must equal basis in v0" \
  node tools/mv-poly-basis/index.js validate --in "$MR/bad-basis-order.basis.json"

expect_fail "bad matrix layout" "matrix_layout_id mismatch" \
  node tools/mv-poly-closed-config/index.js validate --in "$MR/bad-matrix-layout.closed.json" --basis "$BASIS"

expect_fail "bad replay" "replay mismatch" \
  node tools/mv-poly-decompose/index.js validate --in "$MR/bad-replay.poly-decomp.json" --basis "$BASIS" --closed "$CLOSED"

echo "ok wave28 must-reject"
