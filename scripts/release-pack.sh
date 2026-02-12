#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="${RELEASE_VERSION:-v0.1}"
DIST_DIR="${RELEASE_DIST_DIR:-dist/metaverse-kit-${VERSION}}"
TMP_DIR="${DIST_DIR}.tmp"

STORY="${RELEASE_STORY:-../Shape Signature/golden/story_bundle/mini.story_bundle.json}"
WORLD="${RELEASE_WORLD:-../Shape Signature/golden/civic_world_graph/mini.civic_world_graph.json}"
EVENTS="${RELEASE_EVENTS:-../Shape Signature/golden/civic_event_log/mini.civic_event_log.ndjson}"
MULTIVIEW="${RELEASE_MULTIVIEW:-../Shape Signature/golden/multiview_manifest/mini.multiview_manifest.json}"
HARMONIC="${RELEASE_HARMONIC:-../Shape Signature/golden/wave15_harmonic/mini.harmonic.ndjson}"
OBSERVER="${RELEASE_OBSERVER_PROFILE:-../Shape Signature/golden/wave15_harmonic/observer_profile_default.v0.json}"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

npm run -s mv-pack-demo -- \
  --story "$STORY" \
  --world "$WORLD" \
  --events "$EVENTS" \
  --multiview "$MULTIVIEW" \
  --harmonic "$HARMONIC" \
  --observer-profile "$OBSERVER" \
  --out "$TMP_DIR/demo.bundle" \
  --include-portal --force

cp -R portal "$TMP_DIR/portal"
cp RELEASE_NOTES.md "$TMP_DIR/RELEASE_NOTES.md"

(
  cd "$TMP_DIR"
  LC_ALL=C find . -type f ! -name checksums.txt -print0 | sort -z | xargs -0 sha256sum > checksums.txt
)

rm -rf "$DIST_DIR"
mv "$TMP_DIR" "$DIST_DIR"

echo "ok release-pack dist=$DIST_DIR"
