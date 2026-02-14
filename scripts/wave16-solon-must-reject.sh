#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_DIGEST="sha256:090c6c2a8a2ef694bfe1b8824caa542026499627fac4dd93d2149a865d4eb84a"
NARRATIVE="dev-docs/narrative/states.v0.json"
GOOD_STEPS="dev-docs/narrative/solon-path.steps.json"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

expect_fail() {
  local label="$1"
  local needle="$2"
  shift 2
  set +e
  out="$("$@" 2>&1)"
  code=$?
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

# Unknown verb
cp "$GOOD_STEPS" "$TMP_DIR/steps.bad.verb.json"
python3 - <<'PY' "$TMP_DIR/steps.bad.verb.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v[0]["verb"]="BROKEN_VERB"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unknown verb" "verb unknown" \
  node tools/mv-interaction-tape/index.js emit \
    --base-bundle-digest "$BASE_DIGEST" \
    --narrative-state "$NARRATIVE" \
    --steps "$TMP_DIR/steps.bad.verb.json" \
    --out "$TMP_DIR/tape.bad.verb.json"

# Unknown passage id
cp "$GOOD_STEPS" "$TMP_DIR/steps.bad.target.json"
python3 - <<'PY' "$TMP_DIR/steps.bad.target.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v[0]["target"]="sha256:" + "0"*64
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unknown passage" "target unresolved narrative passage" \
  node tools/mv-interaction-tape/index.js emit \
    --base-bundle-digest "$BASE_DIGEST" \
    --narrative-state "$NARRATIVE" \
    --steps "$TMP_DIR/steps.bad.target.json" \
    --out "$TMP_DIR/tape.bad.target.json"

# Wrong stance
cp "$GOOD_STEPS" "$TMP_DIR/steps.bad.stance.json"
python3 - <<'PY' "$TMP_DIR/steps.bad.stance.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v[2]["target"]="invalid_stance"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "invalid stance" "target invalid stance" \
  node tools/mv-interaction-tape/index.js emit \
    --base-bundle-digest "$BASE_DIGEST" \
    --narrative-state "$NARRATIVE" \
    --steps "$TMP_DIR/steps.bad.stance.json" \
    --out "$TMP_DIR/tape.bad.stance.json"

# Wrong generator id
cp "$GOOD_STEPS" "$TMP_DIR/steps.bad.generator.json"
python3 - <<'PY' "$TMP_DIR/steps.bad.generator.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v[3]["target"]="wave16.gen.other.v0"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "wrong generator" "target invalid generator" \
  node tools/mv-interaction-tape/index.js emit \
    --base-bundle-digest "$BASE_DIGEST" \
    --narrative-state "$NARRATIVE" \
    --steps "$TMP_DIR/steps.bad.generator.json" \
    --out "$TMP_DIR/tape.bad.generator.json"

# Bad Solon path for generator stage: missing ARTICLE II open
cp "$GOOD_STEPS" "$TMP_DIR/steps.bad.path.json"
python3 - <<'PY' "$TMP_DIR/steps.bad.path.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
# keep 5 events but remove ARTICLE II by replacing it with PRELUDE/02 target
for evt in v:
    if evt.get("verb")=="OPEN_PASSAGE" and evt.get("target")=="sha256:f1b7e9a344387fcdc70451be2e373d819a36dcba39687342273a6714cd8448c2":
        evt["target"]="sha256:7a133d4b903db17d3d983cd6455723b882b18dafff2d9234e89a1de32b30181a"
        evt["params"]["note"]="prelude-02-duplicate"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
node tools/mv-interaction-tape/index.js emit \
  --base-bundle-digest "$BASE_DIGEST" \
  --narrative-state "$NARRATIVE" \
  --steps "$TMP_DIR/steps.bad.path.json" \
  --out "$TMP_DIR/tape.bad.path.json" >/dev/null
expect_fail "missing article ii" "missing ARTICLE II interaction" \
  node tools/mv-template-generate/index.js \
    --base-bundle-digest "$BASE_DIGEST" \
    --narrative-state "$NARRATIVE" \
    --interaction-tape "$TMP_DIR/tape.bad.path.json" \
    --out "$TMP_DIR/proposal.bad.path.json"

echo "ok wave16 solon must-reject"
