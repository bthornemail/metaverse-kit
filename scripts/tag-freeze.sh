#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${1:-$ROOT_DIR/freeze/freeze-manifest.json}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: manifest not found: $MANIFEST" >&2
  exit 2
fi

LABEL="$(jq -r '.freeze_label' "$MANIFEST")"
if [[ -z "$LABEL" || "$LABEL" == "null" ]]; then
  echo "ERROR: invalid freeze_label in $MANIFEST" >&2
  exit 2
fi

for repo in metaverse-kit light-garden geometry-spine; do
  path="$(jq -r --arg r "$repo" '.repos[$r].path' "$MANIFEST")"
  commit="$(jq -r --arg r "$repo" '.repos[$r].commit' "$MANIFEST")"
  if [[ -z "$path" || "$path" == "null" || -z "$commit" || "$commit" == "null" ]]; then
    echo "ERROR: missing repo metadata for $repo in $MANIFEST" >&2
    exit 2
  fi

  if git -C "$path" rev-parse -q --verify "refs/tags/$LABEL" >/dev/null; then
    echo "tag exists: $repo -> $LABEL"
    continue
  fi

  git -C "$path" tag -a "$LABEL" "$commit" -m "Freeze anchor $LABEL"
  echo "tagged: $repo -> $LABEL @ $commit"
done

echo "local tags created. push explicitly when ready:"
echo "  git -C \"$ROOT_DIR\" push origin \"$LABEL\""
