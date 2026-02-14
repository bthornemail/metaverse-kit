#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORLD="dev-docs/wave19/world-graph.v0.json"
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

cp dev-docs/wave23/archetype-signature.v0.json "$TMP_DIR/archetype.bad.id.json"
python3 - <<'PY' "$TMP_DIR/archetype.bad.id.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['archetype_id']='unknown'
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "bad archetype id" "archetype_id invalid" \
  node tools/mv-archetype/index.js validate --world-graph "$WORLD" --archetype "$TMP_DIR/archetype.bad.id.json"

cp dev-docs/wave23/archetype-signature.v0.json "$TMP_DIR/archetype.bad.digest.json"
python3 - <<'PY' "$TMP_DIR/archetype.bad.digest.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['digest']='sha256:'+'0'*64
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "bad digest" "digest mismatch" \
  node tools/mv-archetype/index.js validate --world-graph "$WORLD" --archetype "$TMP_DIR/archetype.bad.digest.json"

cp dev-docs/wave23/archetype-signature.v0.json "$TMP_DIR/archetype.bad.world.json"
python3 - <<'PY' "$TMP_DIR/archetype.bad.world.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['world_graph_digest']='sha256:'+'f'*64
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "world digest mismatch" "world_graph_digest mismatch" \
  node tools/mv-archetype/index.js validate --world-graph "$WORLD" --archetype "$TMP_DIR/archetype.bad.world.json"

echo "ok wave23 must-reject"
