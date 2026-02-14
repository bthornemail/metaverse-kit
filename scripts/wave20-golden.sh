#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED="dev-docs/wave20/behavior-grammar.seed.json"
WORLD_GRAPH="dev-docs/wave19/world-graph.v0.json"
GOLDEN="dev-docs/wave20/behavior-grammar.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-behavior-grammar/index.js emit --seed "$SEED" --world-graph "$WORLD_GRAPH" --out "$OUT_A"
node tools/mv-behavior-grammar/index.js emit --seed "$SEED" --world-graph "$WORLD_GRAPH" --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: wave20 emit not deterministic" >&2; exit 2; }

node tools/mv-behavior-grammar/index.js validate --behavior-grammar "$OUT_A" --world-graph "$WORLD_GRAPH"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave20 golden mismatch" >&2; exit 2; }

echo "ok wave20 golden"
