#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORLD="dev-docs/wave19/world-graph.v0.json"
PROVIDER="dev-docs/wave25/provider-extension.v0.json"
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

cp dev-docs/wave26/consumer-trace.v0.json "$TMP_DIR/trace.bad.provider.json"
python3 - <<'PY' "$TMP_DIR/trace.bad.provider.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['provider_magnitude_m']='0'
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "provider mismatch" "provider_magnitude_m mismatch" \
  node tools/mv-consumer-metric/index.js validate --consumer-trace "$TMP_DIR/trace.bad.provider.json" --provider-extension "$PROVIDER" --world-graph "$WORLD"

cp dev-docs/wave26/consumer-trace.v0.json "$TMP_DIR/trace.bad.q.json"
python3 - <<'PY' "$TMP_DIR/trace.bad.q.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v['q_value']='abc'
json.dump(v, open(p,'w'), separators=(',',':'))
PY
expect_fail "bad q" "q_value must be integer string" \
  node tools/mv-consumer-metric/index.js validate --consumer-trace "$TMP_DIR/trace.bad.q.json" --provider-extension "$PROVIDER" --world-graph "$WORLD"

echo "ok wave26 must-reject"
