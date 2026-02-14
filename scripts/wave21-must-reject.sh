#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NARRATIVE="dev-docs/narrative/states.v0.json"
WORLD_ENTITIES="dev-docs/wave19/world-entities.v0.json"
WORLD_GRAPH="dev-docs/wave19/world-graph.v0.json"
BEHAVIOR="dev-docs/wave20/behavior-grammar.v0.json"
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

# behavior references missing entity
cp "$BEHAVIOR" "$TMP_DIR/behavior.bad.node.json"
python3 - <<'PY' "$TMP_DIR/behavior.bad.node.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['rules'][0]['target_node']='sha256:' + '0'*64
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "missing behavior target" "alignment failed checks" \
  node tools/mv-alignment/index.js emit --narrative-state "$NARRATIVE" --world-entities "$WORLD_ENTITIES" --world-graph "$WORLD_GRAPH" --behavior-grammar "$TMP_DIR/behavior.bad.node.json" --out "$TMP_DIR/out1.json"

# narrative references missing role
cp "$NARRATIVE" "$TMP_DIR/narrative.bad.role.json"
python3 - <<'PY' "$TMP_DIR/narrative.bad.role.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['states'][0]['dialogue_roles'][0]='unknown_role'
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "missing narrative role" "alignment failed checks" \
  node tools/mv-alignment/index.js emit --narrative-state "$TMP_DIR/narrative.bad.role.json" --world-entities "$WORLD_ENTITIES" --world-graph "$WORLD_GRAPH" --behavior-grammar "$BEHAVIOR" --out "$TMP_DIR/out2.json"

# cyclic behavior dependency
cp "$BEHAVIOR" "$TMP_DIR/behavior.bad.cycle.json"
python3 - <<'PY' "$TMP_DIR/behavior.bad.cycle.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
# create cycle opposite direction
v['rules'][1]['source_node']='sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
v['rules'][1]['target_node']='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "cyclic behavior" "alignment failed checks" \
  node tools/mv-alignment/index.js emit --narrative-state "$NARRATIVE" --world-entities "$WORLD_ENTITIES" --world-graph "$WORLD_GRAPH" --behavior-grammar "$TMP_DIR/behavior.bad.cycle.json" --out "$TMP_DIR/out3.json"

# non deterministic projection ordering (tampered report)
cp dev-docs/wave21/alignment.v0.json "$TMP_DIR/alignment.bad.order.json"
python3 - <<'PY' "$TMP_DIR/alignment.bad.order.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['projection_order']=['world_graph','world_entities','narrative_state','behavior_grammar']
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "projection order mismatch" "projection_order mismatch" \
  node tools/mv-alignment/index.js validate --alignment "$TMP_DIR/alignment.bad.order.json"

echo "ok wave21 alignment must-reject"
