#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED="dev-docs/wave26/consumer.seed.json"
WORLD="dev-docs/wave19/world-graph.v0.json"
PROVIDER="dev-docs/wave25/provider-extension.v0.json"
GOLDEN="dev-docs/wave26/consumer-trace.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-consumer-metric/index.js emit --seed "$SEED" --provider-extension "$PROVIDER" --world-graph "$WORLD" --out "$OUT_A"
node tools/mv-consumer-metric/index.js emit --seed "$SEED" --provider-extension "$PROVIDER" --world-graph "$WORLD" --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: wave26 emit not deterministic" >&2; exit 2; }

node tools/mv-consumer-metric/index.js validate --consumer-trace "$OUT_A" --provider-extension "$PROVIDER" --world-graph "$WORLD"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave26 golden mismatch" >&2; exit 2; }

echo "ok wave26 golden"
