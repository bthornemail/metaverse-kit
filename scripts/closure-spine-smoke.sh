#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

LIGHT_GARDEN_DIR="${LIGHT_GARDEN_DIR:-$WORKSPACE_ROOT/light-garden}"
GEOMETRY_SPINE_DIR="${GEOMETRY_SPINE_DIR:-$WORKSPACE_ROOT/geometry-spine}"
AUTHORITY_GATE_PATH="${AUTHORITY_GATE_PATH:-$GEOMETRY_SPINE_DIR/authority/gate/AuthorityProjection.hs}"
AUTHORITY_STRICT="${AUTHORITY_STRICT:-true}"
AUTHORITY_CLASS="${AUTHORITY_CLASS:-projection}"
DIST_DIR="${DIST_DIR:-dist/metaverse-kit-v0.1}"
ATTEST_DIR="$ROOT_DIR/artifacts"
ATTEST_PATH="$ATTEST_DIR/gate-attestation.json"

sha256_file() {
  local p="$1"
  if [[ -f "$p" ]]; then
    sha256sum "$p" | awk '{print $1}'
  else
    echo ""
  fi
}

git_sha() {
  local p="$1"
  git -C "$p" rev-parse HEAD
}

git_dirty() {
  local p="$1"
  if [[ -n "$(git -C "$p" status --porcelain 2>/dev/null || true)" ]]; then
    echo "true"
  else
    echo "false"
  fi
}

echo "closure-spine-smoke config:"
echo "  LIGHT_GARDEN_DIR=$LIGHT_GARDEN_DIR"
echo "  GEOMETRY_SPINE_DIR=$GEOMETRY_SPINE_DIR"
echo "  AUTHORITY_GATE_PATH=$AUTHORITY_GATE_PATH"
echo "  AUTHORITY_STRICT=$AUTHORITY_STRICT"
echo "  AUTHORITY_CLASS=$AUTHORITY_CLASS"

if [[ ! -d "$LIGHT_GARDEN_DIR/audit" ]]; then
  echo "ERROR: light-garden audit directory not found at $LIGHT_GARDEN_DIR/audit" >&2
  exit 2
fi

if [[ ! -d "$GEOMETRY_SPINE_DIR" ]]; then
  echo "ERROR: geometry-spine directory not found at $GEOMETRY_SPINE_DIR" >&2
  exit 2
fi

# Capture repository state before gate execution generates any local artifacts.
MK_COMMIT="$(git_sha "$ROOT_DIR")"
LG_COMMIT="$(git_sha "$LIGHT_GARDEN_DIR")"
GS_COMMIT="$(git_sha "$GEOMETRY_SPINE_DIR")"
MK_DIRTY="$(git_dirty "$ROOT_DIR")"
LG_DIRTY="$(git_dirty "$LIGHT_GARDEN_DIR")"
GS_DIRTY="$(git_dirty "$GEOMETRY_SPINE_DIR")"

echo "[1/3] light-garden validate"
npm --prefix "$LIGHT_GARDEN_DIR/audit" run validate --silent
LIGHT_VALIDATE_REPORT="$LIGHT_GARDEN_DIR/audit/artifacts/reports/audit-summary.json"
LIGHT_VALIDATE_REPORT_SHA256="$(sha256_file "$LIGHT_VALIDATE_REPORT")"
LIGHT_WORDNET_LOG="$(ls -1t "$LIGHT_GARDEN_DIR"/audit/artifacts/logs/*-wordnet.log 2>/dev/null | head -n1 || true)"
LIGHT_CSERVER_LOG="$(ls -1t "$LIGHT_GARDEN_DIR"/audit/artifacts/logs/*-c-server.log 2>/dev/null | head -n1 || true)"

echo "[2/3] geometry-spine authority checks"
(
  cd "$GEOMETRY_SPINE_DIR"
  AUTHORITY_GATE_PATH="$AUTHORITY_GATE_PATH" \
  AUTHORITY_STRICT="$AUTHORITY_STRICT" \
  AUTHORITY_CLASS="$AUTHORITY_CLASS" \
    bash ./scripts/closure-spine-smoke.sh
)

echo "[3/3] metaverse-kit deterministic release verification"
cd "$ROOT_DIR"
npm run -s release:pack
npm run -s release:verify

if [[ ! -d "$DIST_DIR" ]]; then
  echo "ERROR: expected dist missing after release steps: $DIST_DIR" >&2
  exit 2
fi

mkdir -p "$ATTEST_DIR"

AUTHORITY_GATE_SHA256="$(sha256_file "$AUTHORITY_GATE_PATH")"
DIST_CHECKSUMS_SHA256="$(sha256_file "$DIST_DIR/checksums.txt")"
DIST_MANIFEST_SHA256="$(sha256_file "$DIST_DIR/demo.bundle/manifest.json")"
DIST_INTEGRITY_SHA256="$(sha256_file "$DIST_DIR/demo.bundle/integrity.sha256")"
DIST_TREE_SHA256="$(
  cd "$DIST_DIR"
  find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
)"

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
NODE_VERSION="$(node -v)"
NPM_VERSION="$(npm -v)"
OS_UNAME="$(uname -srm)"
LIBC_INFO="$(ldd --version 2>/dev/null | head -n1 || echo "n/a")"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required to emit gate attestation json" >&2
  exit 2
fi

jq -n \
  --arg timestamp "$TIMESTAMP" \
  --arg node_version "$NODE_VERSION" \
  --arg npm_version "$NPM_VERSION" \
  --arg os_uname "$OS_UNAME" \
  --arg libc_info "$LIBC_INFO" \
  --arg mk_commit "$MK_COMMIT" \
  --arg lg_commit "$LG_COMMIT" \
  --arg gs_commit "$GS_COMMIT" \
  --argjson mk_dirty "$MK_DIRTY" \
  --argjson lg_dirty "$LG_DIRTY" \
  --argjson gs_dirty "$GS_DIRTY" \
  --arg authority_gate_path "$AUTHORITY_GATE_PATH" \
  --arg authority_gate_sha256 "$AUTHORITY_GATE_SHA256" \
  --arg authority_strict "$AUTHORITY_STRICT" \
  --arg authority_class "$AUTHORITY_CLASS" \
  --arg light_validate_report "$LIGHT_VALIDATE_REPORT" \
  --arg light_validate_report_sha256 "$LIGHT_VALIDATE_REPORT_SHA256" \
  --arg light_wordnet_log "${LIGHT_WORDNET_LOG:-}" \
  --arg light_cserver_log "${LIGHT_CSERVER_LOG:-}" \
  --arg dist_dir "$DIST_DIR" \
  --arg dist_checksums_sha256 "$DIST_CHECKSUMS_SHA256" \
  --arg dist_manifest_sha256 "$DIST_MANIFEST_SHA256" \
  --arg dist_integrity_sha256 "$DIST_INTEGRITY_SHA256" \
  --arg dist_tree_sha256 "$DIST_TREE_SHA256" \
  '{
    timestamp: $timestamp,
    environment: {
      node_version: $node_version,
      npm_version: $npm_version,
      os_uname: $os_uname,
      libc_info: $libc_info
    },
    repos: {
      "metaverse-kit": { commit: $mk_commit, dirty: $mk_dirty },
      "light-garden": { commit: $lg_commit, dirty: $lg_dirty },
      "geometry-spine": { commit: $gs_commit, dirty: $gs_dirty }
    },
    authority: {
      gate_path: $authority_gate_path,
      gate_sha256: $authority_gate_sha256,
      strict: $authority_strict,
      class: $authority_class
    },
    light_garden: {
      validate_report: $light_validate_report,
      validate_report_sha256: $light_validate_report_sha256,
      wordnet_log: $light_wordnet_log,
      c_server_log: $light_cserver_log
    },
    metaverse_kit: {
      dist_dir: $dist_dir,
      checksums_txt_sha256: $dist_checksums_sha256,
      demo_bundle_manifest_sha256: $dist_manifest_sha256,
      demo_bundle_integrity_sha256: $dist_integrity_sha256,
      dist_tree_sha256: $dist_tree_sha256
    }
  }' > "$ATTEST_PATH"

cp "$ATTEST_PATH" "$ATTEST_DIR/gate-attestation-${TIMESTAMP//[:]/-}.json"
echo "gate attestation: $ATTEST_PATH"

echo "PASS closure-spine-smoke"
