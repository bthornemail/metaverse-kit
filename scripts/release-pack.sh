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
NARRATIVE_STATE="${RELEASE_NARRATIVE_STATE:-dev-docs/narrative/states.v0.json}"
WORLD_ENTITIES="${RELEASE_WORLD_ENTITIES:-dev-docs/wave19/world-entities.v0.json}"
WORLD_GRAPH="${RELEASE_WORLD_GRAPH:-dev-docs/wave19/world-graph.v0.json}"
BEHAVIOR_GRAMMAR="${RELEASE_BEHAVIOR_GRAMMAR:-dev-docs/wave20/behavior-grammar.v0.json}"
ENTITY_MODEL="${RELEASE_ENTITY_MODEL:-dev-docs/wave19/entity.v0.json}"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

pack_args=(
  --story "$STORY"
  --world "$WORLD"
  --events "$EVENTS"
  --multiview "$MULTIVIEW"
  --harmonic "$HARMONIC"
  --observer-profile "$OBSERVER"
  --out "$TMP_DIR/demo.bundle"
  --include-portal
  --force
)

if [[ -n "$NARRATIVE_STATE" ]]; then
  pack_args+=(--narrative-state "$NARRATIVE_STATE")
fi
if [[ -n "$WORLD_ENTITIES" ]]; then
  pack_args+=(--world-entities "$WORLD_ENTITIES")
fi
if [[ -n "$WORLD_GRAPH" ]]; then
  pack_args+=(--world-graph "$WORLD_GRAPH")
fi
if [[ -n "$BEHAVIOR_GRAMMAR" ]]; then
  pack_args+=(--behavior-grammar "$BEHAVIOR_GRAMMAR")
fi
if [[ -n "$ENTITY_MODEL" ]]; then
  pack_args+=(--entity-model "$ENTITY_MODEL")
fi

npm run -s mv-pack-demo -- \
  "${pack_args[@]}"

cp -R portal "$TMP_DIR/portal"
cp RELEASE_NOTES.md "$TMP_DIR/RELEASE_NOTES.md"

(
  cd "$TMP_DIR"
  LC_ALL=C find . -type f ! -name checksums.txt -print0 | sort -z | xargs -0 sha256sum > checksums.txt
)

rm -rf "$DIST_DIR"
mv "$TMP_DIR" "$DIST_DIR"

echo "ok release-pack dist=$DIST_DIR"
