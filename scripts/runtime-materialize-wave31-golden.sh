#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RECEIPT="dev-docs/wave31/golden/hardware-decode-receipt.v0.json"
VERIFY="dev-docs/wave31/golden/frame-verify-result.v0.json"

[[ -f "$RECEIPT" ]] || { echo "ERROR: missing wave31 receipt fixture" >&2; exit 2; }
[[ -f "$VERIFY" ]] || { echo "ERROR: missing wave31 verify fixture" >&2; exit 2; }

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

IR="$TMP_DIR/world31.ir.json"

node tools/mv-runtime-handoff/index.js build-world-ir-wave31 \
  --receipt "$RECEIPT" \
  --frame-verify "$VERIFY" \
  --out "$IR" \
  --world wave31-verify-v0

WORLD_DIGEST="$(python3 - <<'PY' "$IR"
import json,hashlib,sys
obj=json.load(open(sys.argv[1]))
canon=json.dumps(obj,sort_keys=True,separators=(',',':'))
print('sha256:'+hashlib.sha256((canon+'\n').encode()).hexdigest())
PY
)"

TRACE_A="$TMP_DIR/trace.a.ndjson"
TRACE_B="$TMP_DIR/trace.b.ndjson"
REC_A="$TMP_DIR/receipt.a.json"
REC_B="$TMP_DIR/receipt.b.json"
SNAP_A="$TMP_DIR/snapshot.a.json"
SNAP_B="$TMP_DIR/snapshot.b.json"

node tools/mv-runtime-materialize/index.js materialize-world-ir-wave31 \
  --in "$IR" \
  --out-trace "$TRACE_A" \
  --out-receipt "$REC_A" \
  --out-snapshot "$SNAP_A" \
  --expected-world-ir-digest "$WORLD_DIGEST"

node tools/mv-runtime-materialize/index.js materialize-world-ir-wave31 \
  --in "$IR" \
  --out-trace "$TRACE_B" \
  --out-receipt "$REC_B" \
  --out-snapshot "$SNAP_B" \
  --expected-world-ir-digest "$WORLD_DIGEST"

cmp -s "$TRACE_A" "$TRACE_B" || { echo "ERROR: wave31 runtime trace output not deterministic" >&2; exit 2; }
cmp -s "$REC_A" "$REC_B" || { echo "ERROR: wave31 runtime receipt output not deterministic" >&2; exit 2; }
cmp -s "$SNAP_A" "$SNAP_B" || { echo "ERROR: wave31 runtime snapshot output not deterministic" >&2; exit 2; }

echo "ok runtime materialize wave31 golden"
