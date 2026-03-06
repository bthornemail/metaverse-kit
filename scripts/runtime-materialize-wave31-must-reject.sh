#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RECEIPT="dev-docs/wave31/golden/hardware-decode-receipt.v0.json"
VERIFY="dev-docs/wave31/golden/frame-verify-result.v0.json"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

expect_fail() {
  local label="$1"
  local needle="$2"
  shift 2
  set +e
  local out
  out="$($@ 2>&1)"
  local code=$?
  set -e
  if [[ $code -eq 0 ]]; then
    echo "ERROR: expected failure for $label" >&2
    exit 2
  fi
  grep -Fq "$needle" <<<"$out" || {
    echo "ERROR: missing reject marker for $label: $needle" >&2
    echo "$out" >&2
    exit 2
  }
}

BASE_IR="$TMP_DIR/world31.ir.json"
node tools/mv-runtime-handoff/index.js build-world-ir-wave31 \
  --receipt "$RECEIPT" \
  --frame-verify "$VERIFY" \
  --out "$BASE_IR" \
  --world wave31-verify-v0

# 1) invalid world.ir schema (missing world)
BAD_MISSING_WORLD="$TMP_DIR/bad-missing-world.ir.json"
cat > "$BAD_MISSING_WORLD" <<'JSON'
{"entities":[],"zones":[],"rules":[],"portals":[],"attachments":[],"events":[]}
JSON
expect_fail "missing world schema" "world.ir keyset mismatch" \
  node tools/mv-runtime-materialize/index.js materialize-world-ir-wave31 --in "$BAD_MISSING_WORLD" --out-trace "$TMP_DIR/t1.ndjson" --out-receipt "$TMP_DIR/r1.json"

# 2) missing entity id
BAD_ENTITY_ID="$TMP_DIR/bad-entity-id.ir.json"
python3 - <<'PY' "$BASE_IR" "$BAD_ENTITY_ID"
import json,sys
src,out=sys.argv[1],sys.argv[2]
obj=json.load(open(src))
del obj['entities'][0]['id']
json.dump(obj,open(out,'w'),separators=(',',':'))
PY
expect_fail "missing entity id" "entity[0] keyset mismatch" \
  node tools/mv-runtime-materialize/index.js materialize-world-ir-wave31 --in "$BAD_ENTITY_ID" --out-trace "$TMP_DIR/t2.ndjson" --out-receipt "$TMP_DIR/r2.json"

# 3) duplicate component type
BAD_DUP_COMPONENT="$TMP_DIR/bad-dup-component.ir.json"
python3 - <<'PY' "$BASE_IR" "$BAD_DUP_COMPONENT"
import json,sys
src,out=sys.argv[1],sys.argv[2]
obj=json.load(open(src))
e=obj['entities'][0]
e['components'].append(dict(e['components'][0]))
json.dump(obj,open(out,'w'),separators=(',',':'))
PY
expect_fail "duplicate component type" "duplicate component type" \
  node tools/mv-runtime-materialize/index.js materialize-world-ir-wave31 --in "$BAD_DUP_COMPONENT" --out-trace "$TMP_DIR/t3.ndjson" --out-receipt "$TMP_DIR/r3.json"

# 4) unstable ordering
BAD_UNSORTED="$TMP_DIR/bad-unsorted.ir.json"
python3 - <<'PY' "$BASE_IR" "$BAD_UNSORTED"
import json,sys
src,out=sys.argv[1],sys.argv[2]
obj=json.load(open(src))
obj['entities']=list(reversed(obj['entities']))
json.dump(obj,open(out,'w'),separators=(',',':'))
PY
expect_fail "unsorted entities" "world.ir.entities not sorted" \
  node tools/mv-runtime-materialize/index.js materialize-world-ir-wave31 --in "$BAD_UNSORTED" --out-trace "$TMP_DIR/t4.ndjson" --out-receipt "$TMP_DIR/r4.json"

# 5) world.ir digest mismatch (expected digest guard)
expect_fail "world.ir digest mismatch" "world.ir digest mismatch" \
  node tools/mv-runtime-materialize/index.js materialize-world-ir-wave31 --in "$BASE_IR" --out-trace "$TMP_DIR/t5.ndjson" --out-receipt "$TMP_DIR/r5.json" --expected-world-ir-digest "sha256:0000000000000000000000000000000000000000000000000000000000000000"

echo "ok runtime materialize wave31 must-reject"
