#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT

python3 tools/mv-atomic-kernel/index.py \
  --input fixtures/atomic-kernel/sample-input.json \
  --output "$TMP_OUT" >/dev/null

cmp -s "$TMP_OUT" fixtures/atomic-kernel/expected-output.json || {
  echo "ERROR: atomic-kernel integration output drift" >&2
  echo "expected: fixtures/atomic-kernel/expected-output.json" >&2
  echo "actual:   $TMP_OUT" >&2
  exit 2
}

echo "ok atomic-kernel integration smoke"
