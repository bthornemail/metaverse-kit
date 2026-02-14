#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED="dev-docs/wave19/world-compose.seed.json"
ENTITY="dev-docs/wave19/entity.v0.json"
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

# unresolved entity digest
cp "$SEED" "$TMP_DIR/world.bad.entity.seed.json"
python3 - <<'PY' "$TMP_DIR/world.bad.entity.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["entities"][1]["entity_digest"]="sha256:" + "0"*64
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unresolved entity digest" "unresolved entity_digest" \
  node tools/mv-world-compose/index.js emit --seed "$TMP_DIR/world.bad.entity.seed.json" --entity "$ENTITY" --out "$TMP_DIR/world.bad.entity.json"

# duplicate node id
cp "$SEED" "$TMP_DIR/world.bad.node.seed.json"
python3 - <<'PY' "$TMP_DIR/world.bad.node.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["entities"][1]["node_id"]=v["entities"][0]["node_id"]
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "duplicate node id" "duplicate node_id" \
  node tools/mv-world-compose/index.js emit --seed "$TMP_DIR/world.bad.node.seed.json" --entity "$ENTITY" --out "$TMP_DIR/world.bad.node.json"

# invalid layer
cp "$SEED" "$TMP_DIR/world.bad.layer.seed.json"
python3 - <<'PY' "$TMP_DIR/world.bad.layer.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["entities"][0]["scene_layer"]="invalid"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "invalid layer" "scene_layer invalid" \
  node tools/mv-world-compose/index.js emit --seed "$TMP_DIR/world.bad.layer.seed.json" --entity "$ENTITY" --out "$TMP_DIR/world.bad.layer.json"

echo "ok wave19 world must-reject"
