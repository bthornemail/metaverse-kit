#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LEFT_WORLD="dev-docs/wave17/conflict-world.left.v0.json"
RIGHT_WORLD="dev-docs/wave17/conflict-world.right.v0.json"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

GOOD="$TMP_DIR/good.conflict-bundle.json"
node tools/mv-conflict-bundle/index.js emit \
  --left-world "$LEFT_WORLD" \
  --right-world "$RIGHT_WORLD" \
  --out "$GOOD" >/dev/null

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

# 1) wrong keyset
cp "$GOOD" "$TMP_DIR/bad.extra-key.json"
python3 - <<'PY' "$TMP_DIR/bad.extra-key.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["extra_key"]="boom"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "extra keyset" "keyset mismatch" \
  node tools/mv-conflict-bundle/index.js validate --conflict-bundle "$TMP_DIR/bad.extra-key.json"

# 2) non-string leaf (string membrane)
cp "$GOOD" "$TMP_DIR/bad.non-string.json"
python3 - <<'PY' "$TMP_DIR/bad.non-string.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["recommended_resolution"]["note"]=42
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "non-string leaf" "must be non-empty string" \
  node tools/mv-conflict-bundle/index.js validate --conflict-bundle "$TMP_DIR/bad.non-string.json"

# 3) bad digest format
cp "$GOOD" "$TMP_DIR/bad.digest-format.json"
python3 - <<'PY' "$TMP_DIR/bad.digest-format.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["left_world_digest"]="sha256:xyz"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "bad digest format" "left_world_digest invalid sha256" \
  node tools/mv-conflict-bundle/index.js validate --conflict-bundle "$TMP_DIR/bad.digest-format.json"

# 4) digest mismatch (canonical payload drift)
cp "$GOOD" "$TMP_DIR/bad.digest-mismatch.json"
python3 - <<'PY' "$TMP_DIR/bad.digest-mismatch.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["digest"]="sha256:" + "0"*64
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "digest mismatch" "digest mismatch" \
  node tools/mv-conflict-bundle/index.js validate --conflict-bundle "$TMP_DIR/bad.digest-mismatch.json"

# 5) advisory escalation via authority field
cp "$GOOD" "$TMP_DIR/bad.authority-escalation.json"
python3 - <<'PY' "$TMP_DIR/bad.authority-escalation.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["authority"]="authoritative"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "authority escalation" "conflict_bundle is advisory-only" \
  node tools/mv-conflict-bundle/index.js validate --conflict-bundle "$TMP_DIR/bad.authority-escalation.json"

# 6) forbidden authority-like field
cp "$GOOD" "$TMP_DIR/bad.forbidden-field.json"
python3 - <<'PY' "$TMP_DIR/bad.forbidden-field.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["merge_applied"]="true"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "forbidden authority field" "forbidden field" \
  node tools/mv-conflict-bundle/index.js validate --conflict-bundle "$TMP_DIR/bad.forbidden-field.json"

echo "ok wave17 conflict bundle must-reject"
