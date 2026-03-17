#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="${RELEASE_VERSION:-v0.1}"
DIST_DIR="${RELEASE_DIST_DIR:-dist/metaverse-kit-${VERSION}}"
TMP_DIR="${DIST_DIR}.tmp"

SHAPE_ROOT_DEFAULT="../Shape Signature"
if [[ ! -d "$SHAPE_ROOT_DEFAULT" && -d "$ROOT_DIR/../../Shape Signature" ]]; then
  SHAPE_ROOT_DEFAULT="$ROOT_DIR/../../Shape Signature"
fi
SHAPE_ROOT="${RELEASE_SHAPE_ROOT:-$SHAPE_ROOT_DEFAULT}"

STORY="${RELEASE_STORY:-$SHAPE_ROOT/golden/story_bundle/mini.story_bundle.json}"
WORLD="${RELEASE_WORLD:-$SHAPE_ROOT/golden/civic_world_graph/mini.civic_world_graph.json}"
EVENTS="${RELEASE_EVENTS:-$SHAPE_ROOT/golden/civic_event_log/mini.civic_event_log.ndjson}"
MULTIVIEW="${RELEASE_MULTIVIEW:-$SHAPE_ROOT/golden/multiview_manifest/mini.multiview_manifest.json}"
HARMONIC="${RELEASE_HARMONIC:-$SHAPE_ROOT/golden/wave15_harmonic/mini.harmonic.ndjson}"
OBSERVER="${RELEASE_OBSERVER_PROFILE:-$SHAPE_ROOT/golden/wave15_harmonic/observer_profile_default.v0.json}"
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
