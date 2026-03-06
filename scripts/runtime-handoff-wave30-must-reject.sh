#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SURFACE="dev-docs/wave30/evidence-surface.chords.v0.json"
FRAMES="dev-docs/wave30/evidence-surface.frames.leds240.v0.ndjson"
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

# 1) Reordered payload rejects (t sequence mismatch)
REORDERED="$TMP_DIR/reordered.ndjson"
{ sed -n '2p' "$FRAMES"; sed -n '1p' "$FRAMES"; sed -n '3,$p' "$FRAMES"; } > "$REORDERED"
expect_fail "reordered frames" "t sequence mismatch" \
  node tools/mv-runtime-handoff/index.js build-world-ir --surface "$SURFACE" --frames "$REORDERED" --out "$TMP_DIR/ir1.json"

# 2) Surface digest mismatch rejects
expect_fail "surface digest mismatch" "surface_digest mismatch" \
  node tools/mv-runtime-handoff/index.js build-world-ir --surface "$SURFACE" --frames dev-docs/wave30/must-reject/bad-frame-surface-digest.ndjson --out "$TMP_DIR/ir2.json"

# 3) Unknown frame version rejects
BAD_VERSION="$TMP_DIR/bad-version.ndjson"
python3 - <<'PY' "$FRAMES" "$BAD_VERSION"
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
            obj['v']='wave30.evidence_surface_frame.v999'
        rows.append(obj)
with open(out,'w') as f:
    for r in rows:
        f.write(json.dumps(r,separators=(',',':'))+'\n')
PY
expect_fail "frame version mismatch" "version mismatch" \
  node tools/mv-runtime-handoff/index.js build-world-ir --surface "$SURFACE" --frames "$BAD_VERSION" --out "$TMP_DIR/ir3.json"

# 4) Missing required field rejects
MISSING_WORLD="$TMP_DIR/missing-world.ir.json"
cat > "$MISSING_WORLD" <<'JSON'
{"entities":[],"zones":[],"rules":[],"portals":[],"attachments":[],"events":[]}
JSON
expect_fail "missing world" "world.ir keyset mismatch" \
  node tools/mv-runtime-handoff/index.js verify-world-ir --in "$MISSING_WORLD"

# 5) Unknown extra field rejects
EXTRA_FIELD="$TMP_DIR/extra-field.ir.json"
cat > "$EXTRA_FIELD" <<'JSON'
{"world":"x","entities":[],"zones":[],"rules":[],"portals":[],"attachments":[],"events":[],"extra":"nope"}
JSON
expect_fail "extra field" "world.ir keyset mismatch" \
  node tools/mv-runtime-handoff/index.js verify-world-ir --in "$EXTRA_FIELD"

echo "ok runtime handoff wave30 must-reject"
