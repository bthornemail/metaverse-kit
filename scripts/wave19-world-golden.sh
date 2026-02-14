#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED="dev-docs/wave19/world-compose.seed.json"
ENTITY="dev-docs/wave19/entity.v0.json"
GOLDEN="dev-docs/wave19/world-entities.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-world-compose/index.js emit --seed "$SEED" --entity "$ENTITY" --out "$OUT_A"
node tools/mv-world-compose/index.js emit --seed "$SEED" --entity "$ENTITY" --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: world-compose emit not deterministic" >&2; exit 2; }

node tools/mv-world-compose/index.js validate --world "$OUT_A" --entity "$ENTITY"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave19 world golden mismatch" >&2; exit 2; }

echo "ok wave19 world golden"
