#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BUNDLE="dev-docs/wave17/conflict-bundle.v0.json"
GOLDEN="dev-docs/wave17/merge-review.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-merge-review/index.js emit --conflict-bundle "$BUNDLE" --out "$OUT_A"
node tools/mv-merge-review/index.js emit --conflict-bundle "$BUNDLE" --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: merge review emit not deterministic" >&2; exit 2; }

node tools/mv-merge-review/index.js validate --merge-review "$OUT_A"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave17 merge review golden mismatch" >&2; exit 2; }

echo "ok wave17 merge review golden"
