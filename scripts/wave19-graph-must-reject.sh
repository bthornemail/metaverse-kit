#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED="dev-docs/wave19/world-graph.seed.json"
WORLD_ENTITIES="dev-docs/wave19/world-entities.v0.json"
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

# unresolved source node
cp "$SEED" "$TMP_DIR/graph.bad.node.seed.json"
python3 - <<'PY' "$TMP_DIR/graph.bad.node.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["relations"][0]["source_node"]="sha256:" + "0"*64
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unresolved node" "unresolved source_node" \
  node tools/mv-world-graph/index.js emit --seed "$TMP_DIR/graph.bad.node.seed.json" --world-entities "$WORLD_ENTITIES" --out "$TMP_DIR/graph.bad.node.json"

# duplicate relation id
cp "$SEED" "$TMP_DIR/graph.bad.dup.seed.json"
python3 - <<'PY' "$TMP_DIR/graph.bad.dup.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["relations"][1]["relation_id"]=v["relations"][0]["relation_id"]
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "duplicate relation_id" "duplicate relation_id" \
  node tools/mv-world-graph/index.js emit --seed "$TMP_DIR/graph.bad.dup.seed.json" --world-entities "$WORLD_ENTITIES" --out "$TMP_DIR/graph.bad.dup.json"

# invalid relation type
cp "$SEED" "$TMP_DIR/graph.bad.type.seed.json"
python3 - <<'PY' "$TMP_DIR/graph.bad.type.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["relations"][0]["relation_type"]="invalid"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "invalid relation type" "relation_type invalid" \
  node tools/mv-world-graph/index.js emit --seed "$TMP_DIR/graph.bad.type.seed.json" --world-entities "$WORLD_ENTITIES" --out "$TMP_DIR/graph.bad.type.json"

# digest mismatch (validate)
cp dev-docs/wave19/world-graph.v0.json "$TMP_DIR/graph.bad.digest.json"
python3 - <<'PY' "$TMP_DIR/graph.bad.digest.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["summary"]["relation_count"]="999"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "digest mismatch" "summary mismatch" \
  node tools/mv-world-graph/index.js validate --world-graph "$TMP_DIR/graph.bad.digest.json" --world-entities "$WORLD_ENTITIES"

echo "ok wave19 graph must-reject"
