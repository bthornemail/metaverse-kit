#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

say() { echo "==> $*" >&2; }
die() { echo "ERROR: $*" >&2; exit 2; }

VERSION="${RELEASE_VERSION:-v0.1}"
DIST_DIR="${RELEASE_DIST_DIR:-dist/metaverse-kit-${VERSION}}"
CACHE_DIR=".cache/bundle"
CACHE_KEY_FILE="$CACHE_DIR/release-pack.${VERSION}.input.sha256"

mkdir -p "$CACHE_DIR"

# Mirror `scripts/release-pack.sh` inputs; the bundle must be a pure function
# of these files plus the packager/verifier code.
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

INPUTS=(
  "$STORY"
  "$WORLD"
  "$EVENTS"
  "$MULTIVIEW"
  "$HARMONIC"
  "$OBSERVER"
  "$NARRATIVE_STATE"
  "$WORLD_ENTITIES"
  "$WORLD_GRAPH"
  "$BEHAVIOR_GRAMMAR"
  "$ENTITY_MODEL"
  "scripts/release-pack.sh"
  "scripts/verify-release.sh"
  "tools/mv-pack-demo/index.js"
  "tools/mv-verify-demo/index.js"
  "package-lock.json"
)

# Include portal bytes to prevent "works on my machine" UI drift.
while IFS= read -r f; do
  INPUTS+=("$f")
done < <(LC_ALL=C find portal -type f | LC_ALL=C sort)

for f in "${INPUTS[@]}"; do
  [[ -f "$f" ]] || die "missing input file: $f"
done

say "compute input digest"
current="$(sha256sum "${INPUTS[@]}" | sha256sum | awk '{print $1}')"
prev=""
[[ -f "$CACHE_KEY_FILE" ]] && prev="$(cat "$CACHE_KEY_FILE" | tr -d '\n')" || true

if [[ -d "$DIST_DIR" && -n "$prev" && "$prev" == "$current" ]]; then
  say "inputs unchanged; skipping release:pack"
else
  say "inputs changed (or missing dist); running release:pack"
  npm run -s release:pack
  echo "$current" > "$CACHE_KEY_FILE"
fi

say "verify release bundle"
npm run -s release:verify

say "ok bundle incremental"
