#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORLD="dev-docs/wave19/world-graph.v0.json"
REFLECTED="dev-docs/wave22/reflected-world-graph.v0.json"
GOLDEN="dev-docs/wave23/archetype-signature.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
REF_A="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B" "$REF_A"' EXIT

node tools/mv-archetype/index.js emit --world-graph "$WORLD" --out "$OUT_A"
node tools/mv-archetype/index.js emit --world-graph "$WORLD" --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: wave23 emit not deterministic" >&2; exit 2; }

node tools/mv-archetype/index.js validate --world-graph "$WORLD" --archetype "$OUT_A"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave23 golden mismatch" >&2; exit 2; }

# reflection invariance of archetype class
node tools/mv-archetype/index.js emit --world-graph "$REFLECTED" --out "$REF_A"
BASE_CLASS="$(python3 - <<'PY' "$OUT_A"
import json,sys
print(json.load(open(sys.argv[1]))['archetype_id'])
PY
)"
REF_CLASS="$(python3 - <<'PY' "$REF_A"
import json,sys
print(json.load(open(sys.argv[1]))['archetype_id'])
PY
)"
[[ "$BASE_CLASS" == "$REF_CLASS" ]] || { echo "ERROR: wave23 reflection changed archetype" >&2; exit 2; }

echo "ok wave23 golden"
