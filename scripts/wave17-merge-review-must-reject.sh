#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BUNDLE="dev-docs/wave17/conflict-bundle.v0.json"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

GOOD="$TMP_DIR/good.merge-review.json"
node tools/mv-merge-review/index.js emit --conflict-bundle "$BUNDLE" --out "$GOOD" >/dev/null

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

# 1) advisory-only forbidden field
cp "$GOOD" "$TMP_DIR/bad.forbidden.json"
python3 - <<'PY' "$TMP_DIR/bad.forbidden.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["apply"]="true"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "forbidden authority field" "forbidden field" \
  node tools/mv-merge-review/index.js validate --merge-review "$TMP_DIR/bad.forbidden.json"

# 2) bad ordering
cp "$GOOD" "$TMP_DIR/bad.order.json"
python3 - <<'PY' "$TMP_DIR/bad.order.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["groups"]=list(reversed(v["groups"]))
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unsorted groups" "groups must be sorted" \
  node tools/mv-merge-review/index.js validate --merge-review "$TMP_DIR/bad.order.json"

# 3) bad bundle digest format
cp "$GOOD" "$TMP_DIR/bad.digest-format.json"
python3 - <<'PY' "$TMP_DIR/bad.digest-format.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["bundle_digest"]="sha256:xyz"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "bad bundle digest" "bundle_digest invalid sha256" \
  node tools/mv-merge-review/index.js validate --merge-review "$TMP_DIR/bad.digest-format.json"

# 4) digest mismatch
cp "$GOOD" "$TMP_DIR/bad.digest-mismatch.json"
python3 - <<'PY' "$TMP_DIR/bad.digest-mismatch.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["digest"]="sha256:" + "0"*64
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "digest mismatch" "digest mismatch" \
  node tools/mv-merge-review/index.js validate --merge-review "$TMP_DIR/bad.digest-mismatch.json"

echo "ok wave17 merge review must-reject"
