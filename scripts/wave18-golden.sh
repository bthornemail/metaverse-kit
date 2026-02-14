#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for name in solon solomon asabiyyah metatron; do
  seed="dev-docs/wave18/role.${name}.seed.json"
  golden="dev-docs/wave18/role.${name}.v0.json"
  out_a="$TMP_DIR/role.${name}.a.json"
  out_b="$TMP_DIR/role.${name}.b.json"

  node tools/mv-avatar-role/index.js emit --seed "$seed" --out "$out_a"
  node tools/mv-avatar-role/index.js emit --seed "$seed" --out "$out_b"
  cmp -s "$out_a" "$out_b" || { echo "ERROR: role emit not deterministic: $name" >&2; exit 2; }
  node tools/mv-avatar-role/index.js validate --role "$out_a"
  cmp -s "$out_a" "$golden" || { echo "ERROR: role golden mismatch: $name" >&2; exit 2; }
done

node tools/mv-dialogue-grammar/index.js emit --seed dev-docs/wave18/dialogue-grammar.seed.json --out "$TMP_DIR/dialogue-grammar.v0.json"
node tools/mv-dialogue-grammar/index.js validate --grammar "$TMP_DIR/dialogue-grammar.v0.json"
cmp -s "$TMP_DIR/dialogue-grammar.v0.json" dev-docs/wave18/dialogue-grammar.v0.json || { echo "ERROR: dialogue grammar golden mismatch" >&2; exit 2; }

echo "ok wave18 golden"
