#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASIS="dev-docs/wave28/zero-poly-basis.v0.json"
CONSTRAINTS="dev-docs/wave28/constraints.v0.json"
CARRIER="dev-docs/wave28/carrier-state.v0.json"
CLOSED="dev-docs/wave28/closed-config.v0.json"
DECOMP="dev-docs/wave28/poly-decomp.v0.json"
PROJ="dev-docs/wave28/signal-poly-projection.v0.json"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

node tools/mv-poly-basis/index.js emit --out "$TMP_DIR/basis.a.json"
node tools/mv-poly-basis/index.js emit --out "$TMP_DIR/basis.b.json"
cmp -s "$TMP_DIR/basis.a.json" "$TMP_DIR/basis.b.json" || { echo "ERROR: wave28 basis emit not deterministic" >&2; exit 2; }
cmp -s "$TMP_DIR/basis.a.json" "$BASIS" || { echo "ERROR: wave28 basis golden mismatch" >&2; exit 2; }
node tools/mv-poly-basis/index.js validate --in "$TMP_DIR/basis.a.json"

node tools/mv-poly-closed-config/index.js build --basis "$BASIS" --constraints "$CONSTRAINTS" --carrier "$CARRIER" --out "$TMP_DIR/closed.a.json"
node tools/mv-poly-closed-config/index.js build --basis "$BASIS" --constraints "$CONSTRAINTS" --carrier "$CARRIER" --out "$TMP_DIR/closed.b.json"
cmp -s "$TMP_DIR/closed.a.json" "$TMP_DIR/closed.b.json" || { echo "ERROR: wave28 closed-config build not deterministic" >&2; exit 2; }
cmp -s "$TMP_DIR/closed.a.json" "$CLOSED" || { echo "ERROR: wave28 closed-config golden mismatch" >&2; exit 2; }
node tools/mv-poly-closed-config/index.js validate --in "$TMP_DIR/closed.a.json" --basis "$BASIS"

node tools/mv-poly-decompose/index.js run --basis "$BASIS" --closed "$CLOSED" --poly 'x1+x3*x5+x6' --out "$TMP_DIR/decomp.a.json"
node tools/mv-poly-decompose/index.js run --basis "$BASIS" --closed "$CLOSED" --poly 'x1+x3*x5+x6' --out "$TMP_DIR/decomp.b.json"
cmp -s "$TMP_DIR/decomp.a.json" "$TMP_DIR/decomp.b.json" || { echo "ERROR: wave28 decompose run not deterministic" >&2; exit 2; }
cmp -s "$TMP_DIR/decomp.a.json" "$DECOMP" || { echo "ERROR: wave28 poly-decomp golden mismatch" >&2; exit 2; }
node tools/mv-poly-decompose/index.js validate --in "$TMP_DIR/decomp.a.json" --basis "$BASIS" --closed "$CLOSED"

node tools/mv-poly-signal-project/index.js project --pointer-trace dev-docs/wave27/pointer-sync.trace.commit.ndjson --poly-decomp "$DECOMP" --out "$TMP_DIR/signal-proj.json"
cmp -s "$TMP_DIR/signal-proj.json" "$PROJ" || { echo "ERROR: wave28 signal projection golden mismatch" >&2; exit 2; }
node tools/mv-poly-signal-project/index.js validate --in "$TMP_DIR/signal-proj.json"

echo "ok wave28 golden"
