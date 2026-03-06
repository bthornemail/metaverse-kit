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

# 1) receipt digest mismatch
BAD_RECEIPT_DIGEST="$TMP_DIR/bad-receipt-digest.json"
python3 - <<'PY' "$RECEIPT" "$BAD_RECEIPT_DIGEST"
import json,sys
src,out=sys.argv[1],sys.argv[2]
obj=json.load(open(src))
obj['digest']='sha256:'+'0'*64
json.dump(obj,open(out,'w'),separators=(',',':'))
PY
expect_fail "receipt digest mismatch" "receipt digest" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave31 --receipt "$BAD_RECEIPT_DIGEST" --frame-verify "$VERIFY" --out "$TMP_DIR/o1.json"

# 2) verify_ok invariant mismatch
BAD_VERIFY_OK="$TMP_DIR/bad-verify-ok.json"
python3 - <<'PY' "$VERIFY" "$BAD_VERIFY_OK"
import json,sys,hashlib
src,out=sys.argv[1],sys.argv[2]
obj=json.load(open(src))
obj['verify_ok']='1'
obj['mismatch_count']='2'
obj['first_mismatch_t']='0'
payload={k:obj[k] for k in obj if k!='digest'}
canon=json.dumps(payload,sort_keys=True,separators=(',',':'))
obj['digest']='sha256:'+hashlib.sha256((canon+'\n').encode()).hexdigest()
json.dump(obj,open(out,'w'),separators=(',',':'))
PY
expect_fail "verify_ok mismatch invariant" "verify_ok=1 requires mismatch_count=0" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave31 --receipt "$RECEIPT" --frame-verify "$BAD_VERIFY_OK" --out "$TMP_DIR/o2.json"

# 3) receipt/verify surface digest mismatch
BAD_VERIFY_SURFACE="$TMP_DIR/bad-verify-surface.json"
python3 - <<'PY' "$VERIFY" "$BAD_VERIFY_SURFACE"
import json,sys,hashlib
src,out=sys.argv[1],sys.argv[2]
obj=json.load(open(src))
obj['surface_digest']='sha256:'+'1'*64
payload={k:obj[k] for k in obj if k!='digest'}
canon=json.dumps(payload,sort_keys=True,separators=(',',':'))
obj['digest']='sha256:'+hashlib.sha256((canon+'\n').encode()).hexdigest()
json.dump(obj,open(out,'w'),separators=(',',':'))
PY
expect_fail "surface digest mismatch" "surface_digest mismatch" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave31 --receipt "$RECEIPT" --frame-verify "$BAD_VERIFY_SURFACE" --out "$TMP_DIR/o3.json"

# 4) missing required world.ir field
MISSING_WORLD="$TMP_DIR/missing-world.ir.json"
cat > "$MISSING_WORLD" <<'JSON'
{"entities":[],"zones":[],"rules":[],"portals":[],"attachments":[],"events":[]}
JSON
expect_fail "missing world" "world.ir keyset mismatch" \
  node tools/mv-runtime-handoff/index.js verify-world-ir --in "$MISSING_WORLD"

# 5) extra unknown world.ir key
EXTRA_FIELD="$TMP_DIR/extra-field.ir.json"
cat > "$EXTRA_FIELD" <<'JSON'
{"world":"x","entities":[],"zones":[],"rules":[],"portals":[],"attachments":[],"events":[],"extra":"nope"}
JSON
expect_fail "extra world.ir key" "world.ir keyset mismatch" \
  node tools/mv-runtime-handoff/index.js verify-world-ir --in "$EXTRA_FIELD"

echo "ok runtime handoff wave31 must-reject"
