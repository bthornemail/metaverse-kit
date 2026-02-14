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

# unknown operator
expect_fail "unknown operator" "reflection_operator_id invalid" \
  node tools/mv-reflect/index.js emit --world-graph "$WORLD" --operator nope --out "$TMP_DIR/out.badop.json"

# digest mismatch in reflection result
cp dev-docs/wave22/reflection-result.v0.json "$TMP_DIR/reflection.bad.digest.json"
python3 - <<'PY' "$TMP_DIR/reflection.bad.digest.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['result_digest']='sha256:'+'0'*64
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "digest mismatch" "result_digest mismatch" \
  node tools/mv-reflect/index.js validate --world-graph "$WORLD" --reflection "$TMP_DIR/reflection.bad.digest.json"

# proof tamper
cp dev-docs/wave22/reflection-result.v0.json "$TMP_DIR/reflection.bad.proof.json"
python3 - <<'PY' "$TMP_DIR/reflection.bad.proof.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['proof_of_involution']='0'
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "proof tamper" "proof_of_involution must be 1" \
  node tools/mv-reflect/index.js validate --world-graph "$WORLD" --reflection "$TMP_DIR/reflection.bad.proof.json"

echo "ok wave22 must-reject"
