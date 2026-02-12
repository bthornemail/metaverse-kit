#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_TAG="${RELEASE_IMAGE_TAG:-metaverse-kit:v0.1}"
CONTAINER_NAME="metaverse-kit-release-smoke"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found" >&2
  exit 2
fi

if ! docker image inspect "$IMAGE_TAG" >/dev/null 2>&1; then
  echo "ERROR: image missing: $IMAGE_TAG (run npm run release:docker first)" >&2
  exit 2
fi

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

# Nginx with --read-only needs writable temp dirs.
docker run \
  --name "$CONTAINER_NAME" \
  -d \
  -p 18080:80 \
  --read-only \
  --tmpfs /var/cache/nginx \
  --tmpfs /var/run \
  --tmpfs /tmp \
  "$IMAGE_TAG" >/dev/null

# Wait for startup with bounded retries.
for _ in $(seq 1 20); do
  if curl -fsS http://localhost:18080/checksums.txt >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

curl -fsS http://localhost:18080/checksums.txt >/dev/null
curl -fsS http://localhost:18080/demo.bundle/manifest.json >/dev/null
curl -fsS http://localhost:18080/demo.bundle/portal/index.html >/dev/null

echo "ok release-docker-smoke image=$IMAGE_TAG"
