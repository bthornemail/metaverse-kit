#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SURFACE="dev-docs/wave30/evidence-surface.chords.v0.json"
FRAMES="dev-docs/wave30/evidence-surface.frames.leds240.v0.ndjson"
EMITTER="dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson"
UART="dev-docs/wave30/evidence-surface.uart.esp32.v0.ndjson"
W31_RECEIPT="dev-docs/wave31/golden/hardware-decode-receipt.v0.json"
W31_VERIFY="dev-docs/wave31/golden/frame-verify-result.v0.json"
METABUILD_DIR="/home/main/devops/metaverse-build"
MATERIALIZE="$METABUILD_DIR/runtime/world/materialize.py"
REPLAY="$METABUILD_DIR/runtime/world/replay.py"

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
  grep -Fq -- "$needle" <<<"$out" || {
    echo "ERROR: missing reject marker for $label: $needle" >&2
    echo "$out" >&2
    exit 2
  }
}

# 1) invalid/missing required Wave30 file
expect_fail "missing surface file" "ENOENT" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave30 --surface "$TMP_DIR/missing.surface.json" --frames "$FRAMES" --out "$TMP_DIR/o1.json"

# 2) digest mismatch in declared artifact
expect_fail "bad frame digest" "digest mismatch" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave30 --surface "$SURFACE" --frames dev-docs/wave30/must-reject/bad-frame-digest.ndjson --out "$TMP_DIR/o2.json"

# 3) reordered frame stream where order is authoritative
REORDERED="$TMP_DIR/reordered.ndjson"
{ sed -n '2p' "$FRAMES"; sed -n '1p' "$FRAMES"; sed -n '3,$p' "$FRAMES"; } > "$REORDERED"
expect_fail "reordered frames" "t sequence mismatch" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave30 --surface "$SURFACE" --frames "$REORDERED" --out "$TMP_DIR/o3.json"

# 4) invalid surface_digest propagation
expect_fail "surface digest mismatch" "surface_digest mismatch" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave30 --surface "$SURFACE" --frames dev-docs/wave30/must-reject/bad-frame-surface-digest.ndjson --out "$TMP_DIR/o4.json"

# 5) malformed world.ir.v0
BAD_IR="$TMP_DIR/bad.world.ir.json"
cat > "$BAD_IR" <<'JSON'
{"world":"x","entities":{},"zones":[],"rules":[],"portals":[],"attachments":[],"events":[]}
JSON
expect_fail "malformed world.ir" "world.ir.entities must be array" \
  node tools/mv-runtime-handoff/index.js verify-world-ir --in "$BAD_IR"

# 6) runtime output drift across reruns
IR="$TMP_DIR/world.ir.json"
node tools/mv-runtime-handoff/index.js build-world-ir-wave30 --surface "$SURFACE" --frames "$FRAMES" --out "$IR" >/dev/null
python3 "$MATERIALIZE" "$IR" "$TMP_DIR/snap.a.json" "$TMP_DIR/trace.a.ndjson" >/dev/null
python3 "$MATERIALIZE" "$IR" "$TMP_DIR/snap.b.json" "$TMP_DIR/trace.b.ndjson" >/dev/null
echo '{"type":"DRIFT"}' >> "$TMP_DIR/trace.b.ndjson"
set +e
DRIFT_HASH_A="$(python3 "$REPLAY" "$TMP_DIR/trace.a.ndjson" "$TMP_DIR/replay.a.json" 2>/dev/null)"
DRIFT_HASH_B="$(python3 "$REPLAY" "$TMP_DIR/trace.b.ndjson" "$TMP_DIR/replay.b.json" 2>/dev/null)"
set -e
[[ "$DRIFT_HASH_A" != "$DRIFT_HASH_B" ]] || { echo "ERROR: expected replay drift mismatch" >&2; exit 2; }

# 7) adapter introducing undeclared semantic defaults
BAD_DEFAULTS="$TMP_DIR/bad-defaults.ndjson"
python3 - <<'PY' "$FRAMES" "$BAD_DEFAULTS"
import json,sys
src,out=sys.argv[1],sys.argv[2]
rows=[]
with open(src) as f:
    for i,l in enumerate(f):
        l=l.strip()
        if not l:
            continue
        obj=json.loads(l)
        if i==0:
            obj.pop('pointer_on',None)
        rows.append(obj)
with open(out,'w') as f:
    for r in rows:
        f.write(json.dumps(r,separators=(',',':'))+'\n')
PY
expect_fail "undeclared semantic default" "keyset mismatch" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave30 --surface "$SURFACE" --frames "$BAD_DEFAULTS" --out "$TMP_DIR/o7.json"

# 8) Wave31 receipt treated as authority-bearing input
BAD_W31_AUTH="$TMP_DIR/bad-wave31-authority.json"
python3 - <<'PY' "$W31_RECEIPT" "$BAD_W31_AUTH"
import json,sys,hashlib
src,out=sys.argv[1],sys.argv[2]
obj=json.load(open(src))
obj['authority']='authoritative'
payload={k:obj[k] for k in obj if k!='digest'}
canon=json.dumps(payload,sort_keys=True,separators=(',',':'))+'\n'
obj['digest']='sha256:'+hashlib.sha256(canon.encode()).hexdigest()
json.dump(obj,open(out,'w'),separators=(',',':'))
PY
expect_fail "wave31 authority escalation" "authority must be advisory" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave30 --surface "$SURFACE" --frames "$FRAMES" --wave31-receipt "$BAD_W31_AUTH" --wave31-frame-verify "$W31_VERIFY" --out "$TMP_DIR/o8.json"

# 9) malformed UART packet stream context
expect_fail "uart missing emitter context" "--uart requires --emitter context" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave30 --surface "$SURFACE" --frames "$FRAMES" --uart "$UART" --out "$TMP_DIR/o9.json"

# 10) unknown keys in strict-keyset artifacts
BAD_SURFACE="$TMP_DIR/bad-surface.json"
python3 - <<'PY' "$SURFACE" "$BAD_SURFACE"
import json,sys
src,out=sys.argv[1],sys.argv[2]
obj=json.load(open(src))
obj['unknown']='x'
json.dump(obj,open(out,'w'),separators=(',',':'))
PY
expect_fail "unknown keys strict keyset" "surface keyset mismatch" \
  node tools/mv-runtime-handoff/index.js build-world-ir-wave30 --surface "$BAD_SURFACE" --frames "$FRAMES" --out "$TMP_DIR/o10.json"

echo "ok runtime handoff wave30 to world.ir must-reject"
