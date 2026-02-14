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

# unknown entity type
cp dev-docs/wave19/entity.seed.json "$TMP_DIR/entity.bad.type.seed.json"
python3 - <<'PY' "$TMP_DIR/entity.bad.type.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["type"]="invalid_type"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "invalid entity type" "entity type invalid" \
  node tools/mv-entity-model/index.js emit --seed "$TMP_DIR/entity.bad.type.seed.json" --out "$TMP_DIR/entity.bad.type.json"

# canonical mutation bit must remain 0
cp dev-docs/wave19/entity.seed.json "$TMP_DIR/entity.bad.mutation.seed.json"
python3 - <<'PY' "$TMP_DIR/entity.bad.mutation.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["permissions"]["can_mutate_canonical"]="1"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "canonical mutation bit" "can_mutate_canonical must be 0" \
  node tools/mv-entity-model/index.js emit --seed "$TMP_DIR/entity.bad.mutation.seed.json" --out "$TMP_DIR/entity.bad.mutation.json"

# unknown behavior verb
cp dev-docs/wave19/entity.seed.json "$TMP_DIR/entity.bad.verb.seed.json"
python3 - <<'PY' "$TMP_DIR/entity.bad.verb.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["behaviors"]["allowed_verbs"][1]="BROKEN_VERB"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unknown behavior verb" "allowed_verbs[1] unknown" \
  node tools/mv-entity-model/index.js emit --seed "$TMP_DIR/entity.bad.verb.seed.json" --out "$TMP_DIR/entity.bad.verb.json"

echo "ok wave19 must-reject"
