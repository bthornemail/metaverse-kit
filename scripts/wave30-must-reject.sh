#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

expect_fail "bundle authority" "authority must be advisory" \
  node tools/mv-evidence-bundle/index.js verify --in "$MR/bad-authority.bundle.json"

expect_fail "bundle evidence order" "ordering mismatch" \
  node tools/mv-evidence-bundle/index.js verify --in "$MR/bad-evidence-order.bundle.json"

expect_fail "bundle evidence digest" "evidence_digest mismatch" \
  node tools/mv-evidence-bundle/index.js verify --in "$MR/bad-evidence-digest.bundle.json"

expect_fail "surface seed mismatch" "extraction mismatch" \
  node tools/mv-evidence-surface/index.js verify --in "$MR/bad-surface-seed-mismatch.surface.json"

expect_fail "surface ring size" "ring_size out of range" \
  node tools/mv-evidence-surface/index.js verify --in "$MR/bad-surface-ring-size.surface.json"

expect_fail "surface digest" "digest mismatch" \
  node tools/mv-evidence-surface/index.js verify --in "$MR/bad-surface-digest.surface.json"

echo "ok wave30 must-reject"
