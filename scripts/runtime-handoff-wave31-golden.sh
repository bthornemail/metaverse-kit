#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RECEIPT="dev-docs/wave31/golden/hardware-decode-receipt.v0.json"
VERIFY="dev-docs/wave31/golden/frame-verify-result.v0.json"

METABUILD_DIR="/home/main/devops/metaverse-build"
MATERIALIZE="$METABUILD_DIR/runtime/world/materialize.py"
REPLAY="$METABUILD_DIR/runtime/world/replay.py"

[[ -f "$RECEIPT" ]] || { echo "ERROR: missing wave31 receipt fixture" >&2; exit 2; }
[[ -f "$VERIFY" ]] || { echo "ERROR: missing wave31 verify fixture" >&2; exit 2; }
[[ -f "$MATERIALIZE" ]] || { echo "ERROR: missing metaverse-build materialize.py" >&2; exit 2; }
[[ -f "$REPLAY" ]] || { echo "ERROR: missing metaverse-build replay.py" >&2; exit 2; }

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

IR_A="$TMP_DIR/world31.a.json"
IR_B="$TMP_DIR/world31.b.json"
SNAP_A="$TMP_DIR/snapshot31.a.json"
SNAP_B="$TMP_DIR/snapshot31.b.json"
TRACE_A="$TMP_DIR/trace31.a.ndjson"
REPLAY_SNAP="$TMP_DIR/replay31.snapshot.json"

node tools/mv-runtime-handoff/index.js build-world-ir-wave31 \
  --receipt "$RECEIPT" \
  --frame-verify "$VERIFY" \
  --out "$IR_A" \
  --world wave31-verify-v0

node tools/mv-runtime-handoff/index.js build-world-ir-wave31 \
  --receipt "$RECEIPT" \
  --frame-verify "$VERIFY" \
  --out "$IR_B" \
  --world wave31-verify-v0

cmp -s "$IR_A" "$IR_B" || { echo "ERROR: wave31 world.ir output not deterministic" >&2; exit 2; }
node tools/mv-runtime-handoff/index.js verify-world-ir --in "$IR_A"

HASH_A="$(python3 "$MATERIALIZE" "$IR_A" "$SNAP_A" "$TRACE_A")"
HASH_B="$(python3 "$MATERIALIZE" "$IR_A" "$SNAP_B")"
[[ "$HASH_A" == "$HASH_B" ]] || { echo "ERROR: wave31 materialize hash mismatch across runs" >&2; exit 2; }

HASH_REPLAY="$(python3 "$REPLAY" "$TRACE_A" "$REPLAY_SNAP")"
[[ "$HASH_A" == "$HASH_REPLAY" ]] || { echo "ERROR: wave31 replay hash mismatch vs materialize" >&2; exit 2; }

echo "ok runtime handoff wave31 golden"
