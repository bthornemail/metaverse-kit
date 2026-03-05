#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BUNDLE_GOLDEN="dev-docs/wave30/evidence-bundle.v0.json"
SURFACE_GOLDEN="dev-docs/wave30/evidence-surface.chords.v0.json"
SPIRAL_GOLDEN="dev-docs/wave30/evidence-surface.spiral.v0.json"
SUBJECT="$(jq -r '.digest' dev-docs/wave17/merge-review.v0.json)"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

node tools/mv-evidence-bundle/index.js build \
  --subject-digest "$SUBJECT" \
  --claim-type merge_review \
  --evidence dev-docs/wave27/pointer-sync.residual.fail.v0.json \
  --evidence dev-docs/wave28/signal-poly-projection.v0.json \
  --evidence dev-docs/wave28/poly-decomp.v0.json \
  --evidence dev-docs/wave29/action-plan.with-evidence.v0.json \
  --out "$TMP_DIR/bundle.a.json"

node tools/mv-evidence-bundle/index.js build \
  --subject-digest "$SUBJECT" \
  --claim-type merge_review \
  --evidence dev-docs/wave29/action-plan.with-evidence.v0.json \
  --evidence dev-docs/wave28/poly-decomp.v0.json \
  --evidence dev-docs/wave28/signal-poly-projection.v0.json \
  --evidence dev-docs/wave27/pointer-sync.residual.fail.v0.json \
  --out "$TMP_DIR/bundle.b.json"

cmp -s "$TMP_DIR/bundle.a.json" "$TMP_DIR/bundle.b.json" || { echo "ERROR: wave30 bundle depends on evidence input order" >&2; exit 2; }
cmp -s "$TMP_DIR/bundle.a.json" "$BUNDLE_GOLDEN" || { echo "ERROR: wave30 bundle golden mismatch" >&2; exit 2; }
node tools/mv-evidence-bundle/index.js verify --in "$TMP_DIR/bundle.a.json"

SEED="$(jq -r '.digest' "$TMP_DIR/bundle.a.json")"
node tools/mv-evidence-surface/index.js build --seed-digest "$SEED" --out "$TMP_DIR/surface.a.json"
node tools/mv-evidence-surface/index.js build --seed-digest "$SEED" --out "$TMP_DIR/surface.b.json"
cmp -s "$TMP_DIR/surface.a.json" "$TMP_DIR/surface.b.json" || { echo "ERROR: wave30 surface build not deterministic" >&2; exit 2; }
cmp -s "$TMP_DIR/surface.a.json" "$SURFACE_GOLDEN" || { echo "ERROR: wave30 surface golden mismatch" >&2; exit 2; }
node tools/mv-evidence-surface/index.js verify --in "$TMP_DIR/surface.a.json"

node tools/mv-evidence-surface/index.js render --in "$TMP_DIR/surface.a.json" --mode spiral --out "$TMP_DIR/spiral.json"
cmp -s "$TMP_DIR/spiral.json" "$SPIRAL_GOLDEN" || { echo "ERROR: wave30 spiral golden mismatch" >&2; exit 2; }

echo "ok wave30 golden"
