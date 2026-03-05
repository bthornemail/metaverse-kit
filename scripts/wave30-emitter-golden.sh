#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SURFACE="dev-docs/wave30/evidence-surface.chords.v0.json"
GOLDEN="dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson"
TMP_A="$(mktemp)"
TMP_B="$(mktemp)"
trap 'rm -f "$TMP_A" "$TMP_B"' EXIT

node tools/mv-evidence-surface/index.js render-leds240-esp32 --surface "$SURFACE" --frames 12 --frame-ms 50 --out "$TMP_A"
node tools/mv-evidence-surface/index.js render-leds240-esp32 --surface "$SURFACE" --frames 12 --frame-ms 50 --out "$TMP_B"

cmp -s "$TMP_A" "$TMP_B" || { echo "ERROR: wave30 emitter render not deterministic" >&2; exit 2; }
cmp -s "$TMP_A" "$GOLDEN" || { echo "ERROR: wave30 emitter golden mismatch" >&2; exit 2; }

node tools/mv-evidence-surface/index.js verify-leds240-esp32 --surface "$SURFACE" --frame-ms 50 --in "$TMP_A"

echo "ok wave30 emitter golden"
