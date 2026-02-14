#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LEFT="dev-docs/wave24/world-graph.left.v0.json"
RIGHT="dev-docs/wave24/world-graph.right.v0.json"
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

# incompatible base world digest
cp "$RIGHT" "$TMP_DIR/right.bad.base.json"
python3 - <<'PY' "$TMP_DIR/right.bad.base.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['base_world_entities_digest']='sha256:' + '0'*64
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "incompatible bases" "compatibility reject" \
  node tools/mv-federate/index.js emit --left "$LEFT" --right "$TMP_DIR/right.bad.base.json" --strategy lexicographic --out "$TMP_DIR/out.base.json"

# invalid strategy
expect_fail "invalid strategy" "strategy invalid" \
  node tools/mv-federate/index.js emit --left "$LEFT" --right "$RIGHT" --strategy bad --out "$TMP_DIR/out.strategy.json"

# tampered merge conflict resolution
cp dev-docs/wave24/federation-merge.v0.json "$TMP_DIR/merge.bad.resolution.json"
python3 - <<'PY' "$TMP_DIR/merge.bad.resolution.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
if v['conflict_summary']:
    v['conflict_summary'][0]['resolution']='bad'
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "invalid resolution" "resolution invalid" \
  node tools/mv-federate/index.js validate --left "$LEFT" --right "$RIGHT" --merge "$TMP_DIR/merge.bad.resolution.json"

echo "ok wave24 must-reject"
