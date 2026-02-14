#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NARRATIVE_ROOT="${1:-../narrative-series/When Wisdom, Law, and the Tribe Sat Down Together}"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-narrative-state-project/index.js --root "$NARRATIVE_ROOT" --out "$OUT_A"
node tools/mv-narrative-state-project/index.js --root "$NARRATIVE_ROOT" --out "$OUT_B"

cmp -s "$OUT_A" "$OUT_B" || {
  echo "ERROR: narrative state projector is not deterministic" >&2
  exit 2
}

if [[ -f "dev-docs/narrative/states.v0.json" ]]; then
  cmp -s "$OUT_A" "dev-docs/narrative/states.v0.json" || {
    echo "ERROR: golden mismatch: dev-docs/narrative/states.v0.json" >&2
    exit 2
  }
fi

echo "ok narrative state golden"
