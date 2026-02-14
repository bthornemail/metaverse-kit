#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

# invalid domain in role seed
cp dev-docs/wave18/role.solon.seed.json "$TMP_DIR/role.bad.domain.seed.json"
python3 - <<'PY' "$TMP_DIR/role.bad.domain.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["domain"]="invalid"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "invalid role domain" "domain invalid" \
  node tools/mv-avatar-role/index.js emit --seed "$TMP_DIR/role.bad.domain.seed.json" --out "$TMP_DIR/role.bad.domain.json"

# invalid constraint value in role artifact
cp dev-docs/wave18/role.solon.v0.json "$TMP_DIR/role.bad.constraint.json"
python3 - <<'PY' "$TMP_DIR/role.bad.constraint.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["constraints"]["can_emit_proposals"]="2"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "invalid constraint value" "must be 0|1" \
  node tools/mv-avatar-role/index.js validate --role "$TMP_DIR/role.bad.constraint.json"

# unknown transition verb in dialogue grammar
cp dev-docs/wave18/dialogue-grammar.seed.json "$TMP_DIR/grammar.bad.verb.seed.json"
python3 - <<'PY' "$TMP_DIR/grammar.bad.verb.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["transitions"][0]["verb"]="BROKEN_VERB"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unknown transition verb" "verb unknown" \
  node tools/mv-dialogue-grammar/index.js emit --seed "$TMP_DIR/grammar.bad.verb.seed.json" --out "$TMP_DIR/grammar.bad.verb.json"

# unresolved state reference in emission rules
cp dev-docs/wave18/dialogue-grammar.seed.json "$TMP_DIR/grammar.bad.state.seed.json"
python3 - <<'PY' "$TMP_DIR/grammar.bad.state.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["emission_rules"][0]["state_id"]="sha256:" + "0"*64
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unresolved emission state" "unresolved state" \
  node tools/mv-dialogue-grammar/index.js emit --seed "$TMP_DIR/grammar.bad.state.seed.json" --out "$TMP_DIR/grammar.bad.state.json"

echo "ok wave18 must-reject"
