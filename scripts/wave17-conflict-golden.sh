#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LEFT_WORLD="dev-docs/wave17/conflict-world.left.v0.json"
RIGHT_WORLD="dev-docs/wave17/conflict-world.right.v0.json"
GOLDEN="dev-docs/wave17/conflict-bundle.v0.json"

OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
TRACE_A="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B" "$TRACE_A"' EXIT

node tools/mv-conflict-bundle/index.js emit \
  --left-world "$LEFT_WORLD" \
  --right-world "$RIGHT_WORLD" \
  --out "$OUT_A" \
  --out-trace "$TRACE_A"

node tools/mv-conflict-bundle/index.js emit \
  --left-world "$LEFT_WORLD" \
  --right-world "$RIGHT_WORLD" \
  --out "$OUT_B"

cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: conflict bundle emit not deterministic" >&2; exit 2; }
node tools/mv-conflict-bundle/index.js validate --conflict-bundle "$OUT_A"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave17 conflict bundle golden mismatch" >&2; exit 2; }

echo "ok wave17 conflict bundle golden"
