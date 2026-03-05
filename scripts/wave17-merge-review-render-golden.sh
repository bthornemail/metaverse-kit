#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

INPUT="dev-docs/wave17/merge-review.v0.json"
E1="dev-docs/wave28/signal-poly-projection.v0.json"
E2="dev-docs/wave28/poly-decomp.v0.json"
E3="dev-docs/wave27/pointer-sync.residual.fail.v0.json"
GOLDEN_MD="dev-docs/wave17/merge-review.summary.v0.golden.md"
GOLDEN_JSON="dev-docs/wave17/merge-review.summary.v0.golden.json"
OUT_MD_A="$(mktemp)"
OUT_MD_B="$(mktemp)"
OUT_MD_C="$(mktemp)"
OUT_JSON_A="$(mktemp)"
OUT_JSON_B="$(mktemp)"
OUT_JSON_C="$(mktemp)"
trap 'rm -f "$OUT_MD_A" "$OUT_MD_B" "$OUT_MD_C" "$OUT_JSON_A" "$OUT_JSON_B" "$OUT_JSON_C"' EXIT

node tools/mv-merge-review-render/index.js render --in "$INPUT" --evidence "$E1" --evidence "$E2" --evidence "$E3" --out-md "$OUT_MD_A" --out-json "$OUT_JSON_A" --format both --strict >/dev/null
node tools/mv-merge-review-render/index.js render --in "$INPUT" --evidence "$E1" --evidence "$E2" --evidence "$E3" --out-md "$OUT_MD_B" --out-json "$OUT_JSON_B" --format both --strict >/dev/null
node tools/mv-merge-review-render/index.js render --in "$INPUT" --evidence "$E3" --evidence "$E1" --evidence "$E2" --out-md "$OUT_MD_C" --out-json "$OUT_JSON_C" --format both --strict >/dev/null

cmp -s "$OUT_MD_A" "$OUT_MD_B" || { echo "ERROR: merge review render markdown not deterministic" >&2; exit 2; }
cmp -s "$OUT_JSON_A" "$OUT_JSON_B" || { echo "ERROR: merge review render json not deterministic" >&2; exit 2; }
cmp -s "$OUT_MD_A" "$OUT_MD_C" || { echo "ERROR: merge review render markdown depends on evidence input order" >&2; exit 2; }
cmp -s "$OUT_JSON_A" "$OUT_JSON_C" || { echo "ERROR: merge review render json depends on evidence input order" >&2; exit 2; }
cmp -s "$OUT_MD_A" "$GOLDEN_MD" || { echo "ERROR: merge review render markdown golden mismatch" >&2; exit 2; }
cmp -s "$OUT_JSON_A" "$GOLDEN_JSON" || { echo "ERROR: merge review render json golden mismatch" >&2; exit 2; }

echo "ok wave17 merge review render golden"
