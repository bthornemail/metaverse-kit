#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RING_BASIS="dev-docs/wave27/ring-basis.v0.json"
TRACE_COMMIT="dev-docs/wave27/pointer-sync.trace.commit.ndjson"
TRACE_FAIL="dev-docs/wave27/pointer-sync.trace.fail.ndjson"
RESIDUAL_FAIL="dev-docs/wave27/pointer-sync.residual.fail.v0.json"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

node tools/mv-pointer-sync/index.js emit-ring-basis --out "$TMP_DIR/ring-basis.v0.json"
cmp -s "$TMP_DIR/ring-basis.v0.json" "$RING_BASIS" || { echo "ERROR: wave27 ring basis golden mismatch" >&2; exit 2; }

node tools/mv-pointer-sync/index.js simulate \
  --ring-basis "$RING_BASIS" \
  --steps 12 \
  --a-c7 0 --a-outer 010101 \
  --b-c7 0 --b-outer 010101 \
  --out "$TMP_DIR/commit.a.ndjson"

node tools/mv-pointer-sync/index.js simulate \
  --ring-basis "$RING_BASIS" \
  --steps 12 \
  --a-c7 0 --a-outer 010101 \
  --b-c7 0 --b-outer 010101 \
  --out "$TMP_DIR/commit.b.ndjson"

cmp -s "$TMP_DIR/commit.a.ndjson" "$TMP_DIR/commit.b.ndjson" || { echo "ERROR: wave27 commit trace emit not deterministic" >&2; exit 2; }
cmp -s "$TMP_DIR/commit.a.ndjson" "$TRACE_COMMIT" || { echo "ERROR: wave27 commit trace golden mismatch" >&2; exit 2; }

node tools/mv-pointer-sync/index.js verify \
  --in "$TMP_DIR/commit.a.ndjson" \
  --ring-basis "$RING_BASIS" \
  --a-c7 0 --a-outer 010101 \
  --b-c7 0 --b-outer 010101

node tools/mv-pointer-sync/index.js simulate \
  --ring-basis "$RING_BASIS" \
  --steps 8 \
  --a-c7 0 --a-outer 010101 \
  --b-c7 0 --b-outer 011101 \
  --out "$TMP_DIR/fail.ndjson" \
  --out-residual "$TMP_DIR/fail.residual.json"

cmp -s "$TMP_DIR/fail.ndjson" "$TRACE_FAIL" || { echo "ERROR: wave27 fail trace golden mismatch" >&2; exit 2; }
cmp -s "$TMP_DIR/fail.residual.json" "$RESIDUAL_FAIL" || { echo "ERROR: wave27 fail residual golden mismatch" >&2; exit 2; }

node tools/mv-pointer-sync/index.js verify \
  --in "$TMP_DIR/fail.ndjson" \
  --ring-basis "$RING_BASIS" \
  --a-c7 0 --a-outer 010101 \
  --b-c7 0 --b-outer 011101

echo "ok wave27 pointer sync golden"
