#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED="dev-docs/wave20/behavior-grammar.seed.json"
WORLD_GRAPH="dev-docs/wave19/world-graph.v0.json"
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

# unknown verb
cp "$SEED" "$TMP_DIR/bad.verb.seed.json"
python3 - <<'PY' "$TMP_DIR/bad.verb.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["rules"][0]["verb"]="BROKEN_VERB"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unknown verb" "verb invalid" \
  node tools/mv-behavior-grammar/index.js emit --seed "$TMP_DIR/bad.verb.seed.json" --world-graph "$WORLD_GRAPH" --out "$TMP_DIR/out1.json"

# unresolved node
cp "$SEED" "$TMP_DIR/bad.node.seed.json"
python3 - <<'PY' "$TMP_DIR/bad.node.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["rules"][1]["target_node"]="sha256:" + "0"*64
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unresolved node" "unresolved target_node" \
  node tools/mv-behavior-grammar/index.js emit --seed "$TMP_DIR/bad.node.seed.json" --world-graph "$WORLD_GRAPH" --out "$TMP_DIR/out2.json"

# invalid effect
cp "$SEED" "$TMP_DIR/bad.effect.seed.json"
python3 - <<'PY' "$TMP_DIR/bad.effect.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["rules"][0]["effect"]="mutate"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "invalid effect" "effect invalid" \
  node tools/mv-behavior-grammar/index.js emit --seed "$TMP_DIR/bad.effect.seed.json" --world-graph "$WORLD_GRAPH" --out "$TMP_DIR/out3.json"

# digest mismatch via summary tamper
cp dev-docs/wave20/behavior-grammar.v0.json "$TMP_DIR/bad.digest.json"
python3 - <<'PY' "$TMP_DIR/bad.digest.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["summary"]["rule_count"]="999"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "digest mismatch" "summary mismatch" \
  node tools/mv-behavior-grammar/index.js validate --behavior-grammar "$TMP_DIR/bad.digest.json" --world-graph "$WORLD_GRAPH"

echo "ok wave20 must-reject"
