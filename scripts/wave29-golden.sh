#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROJ="dev-docs/wave28/signal-poly-projection.v0.json"
DECOMP="dev-docs/wave28/poly-decomp.v0.json"
MERGE="dev-docs/wave17/merge-review.v0.json"
RESIDUAL="dev-docs/wave27/pointer-sync.residual.fail.v0.json"
G1="dev-docs/wave29/action-plan.projection-only.v0.json"
G2="dev-docs/wave29/action-plan.with-evidence.v0.json"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

node tools/mv-action-plan/index.js build --projection "$PROJ" --out "$TMP_DIR/plan1.a.json"
node tools/mv-action-plan/index.js build --projection "$PROJ" --out "$TMP_DIR/plan1.b.json"
cmp -s "$TMP_DIR/plan1.a.json" "$TMP_DIR/plan1.b.json" || { echo "ERROR: wave29 projection-only build not deterministic" >&2; exit 2; }
cmp -s "$TMP_DIR/plan1.a.json" "$G1" || { echo "ERROR: wave29 projection-only golden mismatch" >&2; exit 2; }
node tools/mv-action-plan/index.js verify --in "$TMP_DIR/plan1.a.json" --projection "$PROJ"

node tools/mv-action-plan/index.js build --projection "$PROJ" --decomp "$DECOMP" --merge-review "$MERGE" --residual "$RESIDUAL" --out "$TMP_DIR/plan2.a.json"
node tools/mv-action-plan/index.js build --projection "$PROJ" --decomp "$DECOMP" --merge-review "$MERGE" --residual "$RESIDUAL" --out "$TMP_DIR/plan2.b.json"
cmp -s "$TMP_DIR/plan2.a.json" "$TMP_DIR/plan2.b.json" || { echo "ERROR: wave29 evidence build not deterministic" >&2; exit 2; }
cmp -s "$TMP_DIR/plan2.a.json" "$G2" || { echo "ERROR: wave29 evidence golden mismatch" >&2; exit 2; }
node tools/mv-action-plan/index.js verify --in "$TMP_DIR/plan2.a.json" --projection "$PROJ" --decomp "$DECOMP" --merge-review "$MERGE" --residual "$RESIDUAL"

echo "ok wave29 golden"
