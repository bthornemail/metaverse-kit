#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DIST="${RELEASE_DIST_DIR:-dist/metaverse-kit-v0.1}"
if [[ ! -d "$DIST" ]]; then
  echo "ERROR: dist missing: $DIST (run npm run release:pack first)" >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found" >&2
  exit 2
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found" >&2
  exit 2
fi

# Deterministic npm dependency snapshot
if ! npm ls --all --json > "$DIST/sbom-npm-ls.json"; then
  echo "WARN: npm ls reported dependency issues; snapshot still captured in sbom-npm-ls.json" >&2
fi

commit="$(git rev-parse HEAD 2>/dev/null || true)"
tag="$(git describe --tags --exact-match 2>/dev/null || true)"
node_v="$(node -v 2>/dev/null || true)"
npm_v="$(npm -v 2>/dev/null || true)"
checksums_d="$(sha256sum "$DIST/checksums.txt" | awk '{print $1}')"
manifest_d="$(sha256sum "$DIST/demo.bundle/manifest.json" | awk '{print $1}')"
now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat > "$DIST/provenance.json" <<JSON
{
  "schema":"metaverse-kit.provenance.v0",
  "git_commit":"${commit}",
  "git_tag":"${tag}",
  "node_version":"${node_v}",
  "npm_version":"${npm_v}",
  "built_at_utc":"${now}",
  "checksums_sha256":"sha256:${checksums_d}",
  "bundle_manifest_sha256":"sha256:${manifest_d}"
}
JSON

echo "ok release-sbom dist=$DIST"
