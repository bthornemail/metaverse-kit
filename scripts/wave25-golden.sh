#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED="dev-docs/wave25/provider.seed.json"
WORLD="dev-docs/wave19/world-graph.v0.json"
GOLDEN="dev-docs/wave25/provider-extension.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-provider-metric/index.js emit --seed "$SEED" --world-graph "$WORLD" --out "$OUT_A"
node tools/mv-provider-metric/index.js emit --seed "$SEED" --world-graph "$WORLD" --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: wave25 emit not deterministic" >&2; exit 2; }

node tools/mv-provider-metric/index.js validate --provider-extension "$OUT_A" --world-graph "$WORLD"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave25 golden mismatch" >&2; exit 2; }

echo "ok wave25 golden"
