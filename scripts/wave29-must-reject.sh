#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROJ="dev-docs/wave28/signal-poly-projection.v0.json"
DECOMP="dev-docs/wave28/poly-decomp.v0.json"
MERGE="dev-docs/wave17/merge-review.v0.json"
RESIDUAL="dev-docs/wave27/pointer-sync.residual.fail.v0.json"
MR="dev-docs/wave29/must-reject"

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

expect_fail "bad authority" "authority must be advisory" \
  node tools/mv-action-plan/index.js verify --in "$MR/bad-authority.plan.json" --projection "$PROJ"

expect_fail "bad id" "plan_map_id mismatch" \
  node tools/mv-action-plan/index.js verify --in "$MR/bad-id.plan.json" --projection "$PROJ"

expect_fail "bad digest" "digest mismatch" \
  node tools/mv-action-plan/index.js verify --in "$MR/bad-digest.plan.json" --projection "$PROJ"

expect_fail "bad order" "step sequence mismatch" \
  node tools/mv-action-plan/index.js verify --in "$MR/bad-order.plan.json" --projection "$PROJ"

expect_fail "bad recompute" "recompute mismatch" \
  node tools/mv-action-plan/index.js verify --in "$MR/bad-recompute.plan.json" --projection "$PROJ" --decomp "$DECOMP" --merge-review "$MERGE" --residual "$RESIDUAL"

echo "ok wave29 must-reject"
