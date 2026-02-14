#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NARRATIVE_ROOT="${1:-../narrative-series/When Wisdom, Law, and the Tribe Sat Down Together}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cp -r "$NARRATIVE_ROOT" "$TMP_DIR/corpus"

run_expect_fail() {
  local label="$1"
  local needle="$2"
  set +e
  out="$(node tools/mv-narrative-state-project/index.js --root "$TMP_DIR/corpus" 2>&1)"
  code=$?
  set -e
  if [[ $code -eq 0 ]]; then
    echo "ERROR: expected failure: $label" >&2
    exit 2
  fi
  grep -Fq "$needle" <<<"$out" || {
    echo "ERROR: missing reject marker for $label: $needle" >&2
    echo "$out" >&2
    exit 2
  }
}

touch "$TMP_DIR/corpus/.hidden"
run_expect_fail "hidden file" "hidden path not allowed"
rm -f "$TMP_DIR/corpus/.hidden"

printf 'x' > "$TMP_DIR/corpus/oops.png"
run_expect_fail "unsupported extension" "unsupported extension"
rm -f "$TMP_DIR/corpus/oops.png"

ln -s "ARTICLE I.md" "$TMP_DIR/corpus/link.md"
run_expect_fail "symlink" "symlink not allowed"
rm -f "$TMP_DIR/corpus/link.md"

echo "ok narrative state must-reject"
