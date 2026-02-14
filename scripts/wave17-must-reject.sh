#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_DIGEST="sha256:090c6c2a8a2ef694bfe1b8824caa542026499627fac4dd93d2149a865d4eb84a"
GOOD_SEED="dev-docs/wave17/shared-tape.seed.json"
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

# invalid merge strategy
cp "$GOOD_SEED" "$TMP_DIR/bad.strategy.seed.json"
python3 - <<'PY' "$TMP_DIR/bad.strategy.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["merge_log"][0]["strategy"]="invalid_strategy"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "invalid strategy" "strategy invalid" \
  node tools/mv-shared-tape/index.js emit --base-bundle-digest "$BASE_DIGEST" --seed "$TMP_DIR/bad.strategy.seed.json" --out "$TMP_DIR/out1.json"

# unresolved author reference in events
cp "$GOOD_SEED" "$TMP_DIR/bad.author.seed.json"
python3 - <<'PY' "$TMP_DIR/bad.author.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["events"][2]["author_id"]="sha256:" + "0"*64
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unresolved author" "unresolved author_id" \
  node tools/mv-shared-tape/index.js emit --base-bundle-digest "$BASE_DIGEST" --seed "$TMP_DIR/bad.author.seed.json" --out "$TMP_DIR/out2.json"

# non-contiguous t per branch
cp "$GOOD_SEED" "$TMP_DIR/bad.t.seed.json"
python3 - <<'PY' "$TMP_DIR/bad.t.seed.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["events"][3]["t"]="9"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "non contiguous t" "non-contiguous t for branch" \
  node tools/mv-shared-tape/index.js emit --base-bundle-digest "$BASE_DIGEST" --seed "$TMP_DIR/bad.t.seed.json" --out "$TMP_DIR/out3.json"

echo "ok wave17 must-reject"
