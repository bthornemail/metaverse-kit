#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

LABEL="${1:-}"
if [[ -z "$LABEL" ]]; then
  echo "usage: create-freeze-manifest.sh <freeze-label>" >&2
  exit 2
fi

LIGHT_GARDEN_DIR="${LIGHT_GARDEN_DIR:-$WORKSPACE_ROOT/light-garden}"
GEOMETRY_SPINE_DIR="${GEOMETRY_SPINE_DIR:-$WORKSPACE_ROOT/geometry-spine}"
OUT_DIR="$ROOT_DIR/freeze"
OUT_FILE="$OUT_DIR/freeze-manifest.json"

if [[ ! -d "$LIGHT_GARDEN_DIR/.git" ]]; then
  echo "ERROR: light-garden git repo missing at $LIGHT_GARDEN_DIR" >&2
  exit 2
fi

if [[ ! -d "$GEOMETRY_SPINE_DIR/.git" ]]; then
  echo "ERROR: geometry-spine git repo missing at $GEOMETRY_SPINE_DIR" >&2
  exit 2
fi

MK_COMMIT="$(git -C "$ROOT_DIR" rev-parse HEAD)"
LG_COMMIT="$(git -C "$LIGHT_GARDEN_DIR" rev-parse HEAD)"
GS_COMMIT="$(git -C "$GEOMETRY_SPINE_DIR" rev-parse HEAD)"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$OUT_DIR"

jq -n \
  --arg label "$LABEL" \
  --arg created_at "$TS" \
  --arg mk_path "$ROOT_DIR" \
  --arg lg_path "$LIGHT_GARDEN_DIR" \
  --arg gs_path "$GEOMETRY_SPINE_DIR" \
  --arg mk_commit "$MK_COMMIT" \
  --arg lg_commit "$LG_COMMIT" \
  --arg gs_commit "$GS_COMMIT" \
  --arg policy_similarity_mode "strict" \
  --arg policy_rate_limit "100" \
  '{
    freeze_label: $label,
    created_at: $created_at,
    repos: {
      "metaverse-kit": { path: $mk_path, commit: $mk_commit, expected_tag: $label },
      "light-garden": { path: $lg_path, commit: $lg_commit, expected_tag: $label },
      "geometry-spine": { path: $gs_path, commit: $gs_commit, expected_tag: $label }
    },
    gate_policy: {
      WORDNET_SIMILARITY_MODE: $policy_similarity_mode,
      CSERVER_RATE_LIMIT: $policy_rate_limit
    }
  }' > "$OUT_FILE"

echo "wrote freeze manifest: $OUT_FILE"
