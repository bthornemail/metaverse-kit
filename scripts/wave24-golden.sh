#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LEFT="dev-docs/wave24/world-graph.left.v0.json"
RIGHT="dev-docs/wave24/world-graph.right.v0.json"
GOLDEN="dev-docs/wave24/federation-merge.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-federate/index.js emit --left "$LEFT" --right "$RIGHT" --strategy lexicographic --out "$OUT_A"
node tools/mv-federate/index.js emit --left "$LEFT" --right "$RIGHT" --strategy lexicographic --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: wave24 emit not deterministic" >&2; exit 2; }

node tools/mv-federate/index.js validate --left "$LEFT" --right "$RIGHT" --merge "$OUT_A"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave24 golden mismatch" >&2; exit 2; }

echo "ok wave24 golden"
