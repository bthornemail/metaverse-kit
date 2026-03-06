#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SURFACE="dev-docs/wave30/evidence-surface.chords.v0.json"
FRAMES="dev-docs/wave30/evidence-surface.frames.leds240.v0.ndjson"

METABUILD_DIR="/home/main/devops/metaverse-build"
MATERIALIZE="$METABUILD_DIR/runtime/world/materialize.py"
REPLAY="$METABUILD_DIR/runtime/world/replay.py"

[[ -f "$SURFACE" ]] || { echo "ERROR: missing surface fixture" >&2; exit 2; }
[[ -f "$FRAMES" ]] || { echo "ERROR: missing frames fixture" >&2; exit 2; }
[[ -f "$MATERIALIZE" ]] || { echo "ERROR: missing metaverse-build materialize.py" >&2; exit 2; }
[[ -f "$REPLAY" ]] || { echo "ERROR: missing metaverse-build replay.py" >&2; exit 2; }

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

IR_A="$TMP_DIR/world.ir.a.json"
IR_B="$TMP_DIR/world.ir.b.json"
SNAP_A="$TMP_DIR/snapshot.a.json"
SNAP_B="$TMP_DIR/snapshot.b.json"
TRACE_A="$TMP_DIR/trace.a.ndjson"
REPLAY_SNAP="$TMP_DIR/replay.snapshot.json"

node tools/mv-runtime-handoff/index.js build-world-ir \
  --surface "$SURFACE" \
  --frames "$FRAMES" \
  --out "$IR_A" \
  --world wave30-surface-v0

node tools/mv-runtime-handoff/index.js build-world-ir \
  --surface "$SURFACE" \
  --frames "$FRAMES" \
  --out "$IR_B" \
  --world wave30-surface-v0

cmp -s "$IR_A" "$IR_B" || { echo "ERROR: world.ir output not deterministic" >&2; exit 2; }
node tools/mv-runtime-handoff/index.js verify-world-ir --in "$IR_A"

HASH_A="$(python3 "$MATERIALIZE" "$IR_A" "$SNAP_A" "$TRACE_A")"
HASH_B="$(python3 "$MATERIALIZE" "$IR_A" "$SNAP_B")"
[[ "$HASH_A" == "$HASH_B" ]] || { echo "ERROR: materialize hash mismatch across runs" >&2; exit 2; }

HASH_REPLAY="$(python3 "$REPLAY" "$TRACE_A" "$REPLAY_SNAP")"
[[ "$HASH_A" == "$HASH_REPLAY" ]] || { echo "ERROR: replay hash mismatch vs materialize" >&2; exit 2; }

echo "ok runtime handoff wave30 golden"
