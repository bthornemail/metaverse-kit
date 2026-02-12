#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DIST="${RELEASE_DIST_DIR:-dist/metaverse-kit-v0.1}"
IMAGE_TAG="${RELEASE_IMAGE_TAG:-metaverse-kit:v0.1}"

if [[ ! -d "$DIST" ]]; then
  echo "ERROR: dist missing: $DIST (run npm run release:pack first)" >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found" >&2
  exit 2
fi

docker build -t "$IMAGE_TAG" .

mkdir -p "$DIST"
digest="$(docker image inspect "$IMAGE_TAG" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
if [[ -z "$digest" ]]; then
  digest="$(docker image inspect "$IMAGE_TAG" --format '{{.Id}}' 2>/dev/null || true)"
fi
printf '%s\n' "$digest" > "$DIST/docker-image.txt"

echo "ok release-docker image=$IMAGE_TAG"
if [[ -n "$digest" ]]; then
  echo "ok release-docker digest=$(cat "$DIST/docker-image.txt")"
fi
