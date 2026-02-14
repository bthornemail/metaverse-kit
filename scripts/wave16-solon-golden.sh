#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_DIGEST="${1:-sha256:090c6c2a8a2ef694bfe1b8824caa542026499627fac4dd93d2149a865d4eb84a}"
NARRATIVE="dev-docs/narrative/states.v0.json"
STEPS="dev-docs/narrative/solon-path.steps.json"
GOLDEN_TAPE="dev-docs/narrative/solon-path.tape.v0.json"
GOLDEN_PROPOSAL="dev-docs/narrative/solon-constitution.proposal.v0.json"

TAPE_A="$(mktemp)"
TAPE_B="$(mktemp)"
PROPOSAL_A="$(mktemp)"
trap 'rm -f "$TAPE_A" "$TAPE_B" "$PROPOSAL_A"' EXIT

node tools/mv-interaction-tape/index.js emit \
  --base-bundle-digest "$BASE_DIGEST" \
  --narrative-state "$NARRATIVE" \
  --steps "$STEPS" \
  --out "$TAPE_A"
node tools/mv-interaction-tape/index.js emit \
  --base-bundle-digest "$BASE_DIGEST" \
  --narrative-state "$NARRATIVE" \
  --steps "$STEPS" \
  --out "$TAPE_B"
cmp -s "$TAPE_A" "$TAPE_B" || { echo "ERROR: tape emit not deterministic" >&2; exit 2; }

node tools/mv-interaction-tape/index.js validate --narrative-state "$NARRATIVE" --tape "$TAPE_A"

node tools/mv-template-generate/index.js \
  --base-bundle-digest "$BASE_DIGEST" \
  --narrative-state "$NARRATIVE" \
  --interaction-tape "$TAPE_A" \
  --out "$PROPOSAL_A"

cmp -s "$TAPE_A" "$GOLDEN_TAPE" || { echo "ERROR: golden tape mismatch" >&2; exit 2; }
cmp -s "$PROPOSAL_A" "$GOLDEN_PROPOSAL" || { echo "ERROR: golden proposal mismatch" >&2; exit 2; }

echo "ok wave16 solon golden"
