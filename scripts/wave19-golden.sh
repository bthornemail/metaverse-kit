#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED="dev-docs/wave19/entity.seed.json"
GOLDEN="dev-docs/wave19/entity.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-entity-model/index.js emit --seed "$SEED" --out "$OUT_A"
node tools/mv-entity-model/index.js emit --seed "$SEED" --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: entity emit not deterministic" >&2; exit 2; }

node tools/mv-entity-model/index.js validate --entity "$OUT_A"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave19 golden mismatch" >&2; exit 2; }

echo "ok wave19 golden"
