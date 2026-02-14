#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORLD="dev-docs/wave19/world-graph.v0.json"
GOLDEN="dev-docs/wave22/reflection-result.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-reflect/index.js emit --world-graph "$WORLD" --operator swap_endpoints --out "$OUT_A"
node tools/mv-reflect/index.js emit --world-graph "$WORLD" --operator swap_endpoints --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: wave22 emit not deterministic" >&2; exit 2; }

node tools/mv-reflect/index.js validate --world-graph "$WORLD" --reflection "$OUT_A"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave22 golden mismatch" >&2; exit 2; }

echo "ok wave22 golden"
