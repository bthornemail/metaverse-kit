#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GOOD="dev-docs/wave17/merge-review.v0.json"
GOOD_EVIDENCE="dev-docs/wave28/signal-poly-projection.v0.json"
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

# 1) authority escalation
cp "$GOOD" "$TMP_DIR/bad.authority.json"
python3 - <<'PY' "$TMP_DIR/bad.authority.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["authority"]="authoritative"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "authority escalation" "advisory-only" \
  node tools/mv-merge-review-render/index.js render --in "$TMP_DIR/bad.authority.json" --format json --strict

# 2) unknown key
cp "$GOOD" "$TMP_DIR/bad.unknown-key.json"
python3 - <<'PY' "$TMP_DIR/bad.unknown-key.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["x_unknown"]="1"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unknown key" "keyset mismatch" \
  node tools/mv-merge-review-render/index.js render --in "$TMP_DIR/bad.unknown-key.json" --format json --strict

# 3) forbidden authority-like field
cp "$GOOD" "$TMP_DIR/bad.forbidden-field.json"
python3 - <<'PY' "$TMP_DIR/bad.forbidden-field.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["world_state"]="forbidden"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "forbidden field" "forbidden field" \
  node tools/mv-merge-review-render/index.js render --in "$TMP_DIR/bad.forbidden-field.json" --format json --strict

# 4) unsorted groups
cp "$GOOD" "$TMP_DIR/bad.unsorted-groups.json"
python3 - <<'PY' "$TMP_DIR/bad.unsorted-groups.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["groups"]=list(reversed(v["groups"]))
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "unsorted groups" "groups must be sorted" \
  node tools/mv-merge-review-render/index.js render --in "$TMP_DIR/bad.unsorted-groups.json" --format json --strict

# 5) invalid evidence authority
cp "$GOOD_EVIDENCE" "$TMP_DIR/bad.evidence-authority.json"
python3 - <<'PY' "$TMP_DIR/bad.evidence-authority.json"
import json,sys
p=sys.argv[1]
v=json.load(open(p))
v["authority"]="authoritative"
json.dump(v, open(p,"w"), separators=(",",":"))
PY
expect_fail "invalid evidence authority" "evidence signal projection authority must be advisory" \
  node tools/mv-merge-review-render/index.js render --in "$GOOD" --evidence "$TMP_DIR/bad.evidence-authority.json" --format json --strict

echo "ok wave17 merge review render must-reject"
