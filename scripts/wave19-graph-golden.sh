#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED="dev-docs/wave19/world-graph.seed.json"
WORLD_ENTITIES="dev-docs/wave19/world-entities.v0.json"
GOLDEN="dev-docs/wave19/world-graph.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-world-graph/index.js emit --seed "$SEED" --world-entities "$WORLD_ENTITIES" --out "$OUT_A"
node tools/mv-world-graph/index.js emit --seed "$SEED" --world-entities "$WORLD_ENTITIES" --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: world graph emit not deterministic" >&2; exit 2; }

node tools/mv-world-graph/index.js validate --world-graph "$OUT_A" --world-entities "$WORLD_ENTITIES"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave19 graph golden mismatch" >&2; exit 2; }

echo "ok wave19 graph golden"
