#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_DIGEST="${1:-sha256:090c6c2a8a2ef694bfe1b8824caa542026499627fac4dd93d2149a865d4eb84a}"
SEED="dev-docs/wave17/shared-tape.seed.json"
GOLDEN="dev-docs/wave17/shared-tape.v0.json"

OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-shared-tape/index.js emit --base-bundle-digest "$BASE_DIGEST" --seed "$SEED" --out "$OUT_A"
node tools/mv-shared-tape/index.js emit --base-bundle-digest "$BASE_DIGEST" --seed "$SEED" --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: shared tape emit not deterministic" >&2; exit 2; }

node tools/mv-shared-tape/index.js validate --shared-tape "$OUT_A"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave17 golden mismatch" >&2; exit 2; }

echo "ok wave17 golden"
