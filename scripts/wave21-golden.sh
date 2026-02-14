#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NARRATIVE="dev-docs/narrative/states.v0.json"
WORLD_ENTITIES="dev-docs/wave19/world-entities.v0.json"
WORLD_GRAPH="dev-docs/wave19/world-graph.v0.json"
BEHAVIOR="dev-docs/wave20/behavior-grammar.v0.json"
GOLDEN="dev-docs/wave21/alignment.v0.json"
OUT_A="$(mktemp)"
OUT_B="$(mktemp)"
trap 'rm -f "$OUT_A" "$OUT_B"' EXIT

node tools/mv-alignment/index.js emit --narrative-state "$NARRATIVE" --world-entities "$WORLD_ENTITIES" --world-graph "$WORLD_GRAPH" --behavior-grammar "$BEHAVIOR" --out "$OUT_A"
node tools/mv-alignment/index.js emit --narrative-state "$NARRATIVE" --world-entities "$WORLD_ENTITIES" --world-graph "$WORLD_GRAPH" --behavior-grammar "$BEHAVIOR" --out "$OUT_B"
cmp -s "$OUT_A" "$OUT_B" || { echo "ERROR: wave21 alignment emit not deterministic" >&2; exit 2; }

node tools/mv-alignment/index.js validate --alignment "$OUT_A"
cmp -s "$OUT_A" "$GOLDEN" || { echo "ERROR: wave21 alignment golden mismatch" >&2; exit 2; }

echo "ok wave21 alignment golden"
