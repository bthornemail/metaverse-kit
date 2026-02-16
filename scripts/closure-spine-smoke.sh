#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

LIGHT_GARDEN_DIR="${LIGHT_GARDEN_DIR:-$WORKSPACE_ROOT/light-garden}"
GEOMETRY_SPINE_DIR="${GEOMETRY_SPINE_DIR:-$WORKSPACE_ROOT/geometry-spine}"
AUTHORITY_GATE_PATH="${AUTHORITY_GATE_PATH:-$GEOMETRY_SPINE_DIR/authority/gate/AuthorityProjection.hs}"
AUTHORITY_STRICT="${AUTHORITY_STRICT:-true}"
AUTHORITY_CLASS="${AUTHORITY_CLASS:-projection}"
WORDNET_SIMILARITY_MODE="${WORDNET_SIMILARITY_MODE:-strict}"
CSERVER_RATE_LIMIT="${CSERVER_RATE_LIMIT:-100}"
CLOSURE_TIER="${CLOSURE_TIER:-pr-fast}"
DIST_DIR="${DIST_DIR:-}"
ATTEST_DIR="$ROOT_DIR/artifacts"
ATTEST_PATH="$ATTEST_DIR/gate-attestation.json"
DETERMINISM_SWEEP_PATH="$ATTEST_DIR/determinism-sweep.txt"

LIGHT_GARDEN_VALIDATE_TIMEOUT_SEC="${LIGHT_GARDEN_VALIDATE_TIMEOUT_SEC:-600}"
GEOMETRY_AUTHORITY_TIMEOUT_SEC="${GEOMETRY_AUTHORITY_TIMEOUT_SEC:-300}"
METAVERSE_RELEASE_TIMEOUT_SEC="${METAVERSE_RELEASE_TIMEOUT_SEC:-600}"
DETERMINISM_ITERATION_TIMEOUT_SEC="${DETERMINISM_ITERATION_TIMEOUT_SEC:-600}"

export WORDNET_SIMILARITY_MODE
export CSERVER_RATE_LIMIT
export CLOSURE_TIER

PHASE_INDEX=0
PHASE_TOTAL=6
TIMEOUT_BIN=""

resolve_timeout_bin() {
  if command -v timeout >/dev/null 2>&1; then
    TIMEOUT_BIN="timeout"
  elif command -v gtimeout >/dev/null 2>&1; then
    TIMEOUT_BIN="gtimeout"
  else
    echo "ERROR: timeout command not found (need 'timeout' or 'gtimeout')" >&2
    exit 2
  fi
}

run_with_timeout() {
  local seconds="$1"
  local label="$2"
  shift 2
  set +e
  "$TIMEOUT_BIN" "${seconds}s" "$@"
  local rc=$?
  set -e
  if [[ $rc -eq 124 ]]; then
    echo "ERROR: timeout after ${seconds}s while running: $label" >&2
    exit 2
  fi
  return $rc
}

phase() {
  PHASE_INDEX=$((PHASE_INDEX + 1))
  echo "[phase ${PHASE_INDEX}/${PHASE_TOTAL}] $1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 2
  fi
}

require_dir() {
  if [[ ! -d "$1" ]]; then
    echo "ERROR: required directory not found: $1" >&2
    exit 2
  fi
}

print_versions() {
  echo "tool versions:"
  echo "  bash=$(bash --version | head -n1)"
  echo "  git=$(git --version)"
  echo "  node=$(node -v)"
  echo "  npm=$(npm -v)"
  echo "  jq=$(jq --version)"
  echo "  $TIMEOUT_BIN=$($TIMEOUT_BIN --version 2>/dev/null | head -n1 || echo n/a)"
}

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

phase "preflight"
resolve_timeout_bin
require_cmd bash
require_cmd git
require_cmd node
require_cmd npm
require_cmd jq
require_cmd sha256sum
require_cmd find
require_cmd sort
require_cmd xargs
require_cmd date
require_cmd uname
require_dir "$ROOT_DIR"
require_dir "$LIGHT_GARDEN_DIR/audit"
require_dir "$GEOMETRY_SPINE_DIR/scripts"
mkdir -p "$ATTEST_DIR"
print_versions

echo "closure-spine-smoke config:"
echo "  CLOSURE_TIER=$CLOSURE_TIER"
echo "  LIGHT_GARDEN_DIR=$LIGHT_GARDEN_DIR"
echo "  GEOMETRY_SPINE_DIR=$GEOMETRY_SPINE_DIR"
echo "  AUTHORITY_GATE_PATH=$AUTHORITY_GATE_PATH"
echo "  AUTHORITY_STRICT=$AUTHORITY_STRICT"
echo "  AUTHORITY_CLASS=$AUTHORITY_CLASS"
echo "  WORDNET_SIMILARITY_MODE=$WORDNET_SIMILARITY_MODE"
echo "  CSERVER_RATE_LIMIT=$CSERVER_RATE_LIMIT"
echo "  LIGHT_GARDEN_VALIDATE_TIMEOUT_SEC=$LIGHT_GARDEN_VALIDATE_TIMEOUT_SEC"
echo "  GEOMETRY_AUTHORITY_TIMEOUT_SEC=$GEOMETRY_AUTHORITY_TIMEOUT_SEC"
echo "  METAVERSE_RELEASE_TIMEOUT_SEC=$METAVERSE_RELEASE_TIMEOUT_SEC"
echo "  DETERMINISM_ITERATION_TIMEOUT_SEC=$DETERMINISM_ITERATION_TIMEOUT_SEC"

# Capture repository state before gate execution generates any local artifacts.
MK_COMMIT="$(git_sha "$ROOT_DIR")"
LG_COMMIT="$(git_sha "$LIGHT_GARDEN_DIR")"
GS_COMMIT="$(git_sha "$GEOMETRY_SPINE_DIR")"
MK_DIRTY="$(git_dirty "$ROOT_DIR")"
LG_DIRTY="$(git_dirty "$LIGHT_GARDEN_DIR")"
GS_DIRTY="$(git_dirty "$GEOMETRY_SPINE_DIR")"

phase "light-garden validate"
run_with_timeout "$LIGHT_GARDEN_VALIDATE_TIMEOUT_SEC" "light-garden validate" \
  npm --prefix "$LIGHT_GARDEN_DIR/audit" run validate --silent
LIGHT_VALIDATE_REPORT="$LIGHT_GARDEN_DIR/audit/artifacts/reports/audit-summary.json"
LIGHT_VALIDATE_REPORT_SHA256="$(sha256_file "$LIGHT_VALIDATE_REPORT")"
LIGHT_WORDNET_LOG="$(ls -1t "$LIGHT_GARDEN_DIR"/audit/artifacts/logs/*-wordnet.log 2>/dev/null | head -n1 || true)"
LIGHT_CSERVER_LOG="$(ls -1t "$LIGHT_GARDEN_DIR"/audit/artifacts/logs/*-c-server.log 2>/dev/null | head -n1 || true)"

phase "geometry-spine authority checks"
run_with_timeout "$GEOMETRY_AUTHORITY_TIMEOUT_SEC" "geometry-spine closure-spine-smoke" \
  bash -lc "cd \"$GEOMETRY_SPINE_DIR\" && AUTHORITY_GATE_PATH=\"$AUTHORITY_GATE_PATH\" AUTHORITY_STRICT=\"$AUTHORITY_STRICT\" AUTHORITY_CLASS=\"$AUTHORITY_CLASS\" bash ./scripts/closure-spine-smoke.sh"

phase "metaverse-kit release verification"
cd "$ROOT_DIR"
run_with_timeout "$METAVERSE_RELEASE_TIMEOUT_SEC" "metaverse-kit release:pack" npm run -s release:pack
run_with_timeout "$METAVERSE_RELEASE_TIMEOUT_SEC" "metaverse-kit release:verify" npm run -s release:verify

if [[ -z "$DIST_DIR" ]]; then
  DIST_DIR="$(ls -1dt "$ROOT_DIR"/dist/metaverse-kit-* 2>/dev/null | head -n1 || true)"
  if [[ -n "$DIST_DIR" ]]; then
    DIST_DIR="${DIST_DIR#"$ROOT_DIR"/}"
  fi
fi

if [[ ! -d "$DIST_DIR" ]]; then
  echo "ERROR: expected dist missing after release steps: $DIST_DIR" >&2
  exit 2
fi
if [[ -z "$(find "$DIST_DIR" -type f -print -quit)" ]]; then
  echo "ERROR: dist directory has no files: $DIST_DIR" >&2
  exit 2
fi

phase "determinism sweep"
MAIN_DIST_TREE_SHA256="$(
  cd "$DIST_DIR"
  find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
)"
DETERMINISM_STATUS="passed"
DETERMINISM_ITERATIONS=1
{
  echo "closure_tier=$CLOSURE_TIER"
  echo "baseline_dist_dir=$DIST_DIR"
  echo "baseline_dist_tree_sha256=$MAIN_DIST_TREE_SHA256"
} > "$DETERMINISM_SWEEP_PATH"

if [[ "$CLOSURE_TIER" == "nightly-full" ]]; then
  for iter in 2 3; do
    run_with_timeout "$DETERMINISM_ITERATION_TIMEOUT_SEC" "determinism release:pack iteration $iter" npm run -s release:pack
    run_with_timeout "$DETERMINISM_ITERATION_TIMEOUT_SEC" "determinism release:verify iteration $iter" npm run -s release:verify
    CURRENT_DIST_DIR="$(ls -1dt "$ROOT_DIR"/dist/metaverse-kit-* 2>/dev/null | head -n1 || true)"
    CURRENT_DIST_DIR="${CURRENT_DIST_DIR#"$ROOT_DIR"/}"
    CURRENT_DIST_TREE_SHA256="$(
      cd "$CURRENT_DIST_DIR"
      find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
    )"
    DETERMINISM_ITERATIONS="$iter"
    echo "iteration_${iter}_dist_dir=$CURRENT_DIST_DIR" >> "$DETERMINISM_SWEEP_PATH"
    echo "iteration_${iter}_dist_tree_sha256=$CURRENT_DIST_TREE_SHA256" >> "$DETERMINISM_SWEEP_PATH"
    if [[ "$CURRENT_DIST_TREE_SHA256" != "$MAIN_DIST_TREE_SHA256" ]]; then
      DETERMINISM_STATUS="failed"
    fi
  done
else
  DETERMINISM_STATUS="skipped-pr-fast"
  echo "additional_iterations=skipped" >> "$DETERMINISM_SWEEP_PATH"
fi

if [[ "$DETERMINISM_STATUS" == "failed" ]]; then
  echo "ERROR: determinism sweep mismatch detected" >&2
  cat "$DETERMINISM_SWEEP_PATH" >&2 || true
  exit 2
fi

DETERMINISM_SWEEP_SHA256="$(sha256_file "$DETERMINISM_SWEEP_PATH")"

AUTHORITY_GATE_SHA256="$(sha256_file "$AUTHORITY_GATE_PATH")"
DIST_CHECKSUMS_SHA256="$(sha256_file "$DIST_DIR/checksums.txt")"
DIST_MANIFEST_SHA256="$(sha256_file "$DIST_DIR/demo.bundle/manifest.json")"
DIST_INTEGRITY_SHA256="$(sha256_file "$DIST_DIR/demo.bundle/integrity.sha256")"
DIST_TREE_SHA256="$MAIN_DIST_TREE_SHA256"

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
NODE_VERSION="$(node -v)"
NPM_VERSION="$(npm -v)"
OS_UNAME="$(uname -srm)"
if getconf GNU_LIBC_VERSION >/dev/null 2>&1; then
  LIBC_INFO="$(getconf GNU_LIBC_VERSION)"
else
  LIBC_INFO="n/a"
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required to emit gate attestation json" >&2
  exit 2
fi

phase "attestation output"
jq -n \
  --arg timestamp "$TIMESTAMP" \
  --arg closure_tier "$CLOSURE_TIER" \
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
  --arg wordnet_similarity_mode "$WORDNET_SIMILARITY_MODE" \
  --arg cserver_rate_limit "$CSERVER_RATE_LIMIT" \
  --arg light_validate_report "$LIGHT_VALIDATE_REPORT" \
  --arg light_validate_report_sha256 "$LIGHT_VALIDATE_REPORT_SHA256" \
  --arg light_wordnet_log "${LIGHT_WORDNET_LOG:-}" \
  --arg light_cserver_log "${LIGHT_CSERVER_LOG:-}" \
  --arg dist_dir "$DIST_DIR" \
  --arg dist_checksums_sha256 "$DIST_CHECKSUMS_SHA256" \
  --arg dist_manifest_sha256 "$DIST_MANIFEST_SHA256" \
  --arg dist_integrity_sha256 "$DIST_INTEGRITY_SHA256" \
  --arg dist_tree_sha256 "$DIST_TREE_SHA256" \
  --arg determinism_sweep_path "$DETERMINISM_SWEEP_PATH" \
  --arg determinism_sweep_sha256 "$DETERMINISM_SWEEP_SHA256" \
  --arg determinism_status "$DETERMINISM_STATUS" \
  --argjson determinism_iterations "$DETERMINISM_ITERATIONS" \
  '{
    timestamp: $timestamp,
    closure_tier: $closure_tier,
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
    gate_policy: {
      WORDNET_SIMILARITY_MODE: $wordnet_similarity_mode,
      CSERVER_RATE_LIMIT: $cserver_rate_limit
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
    },
    determinism_sweep: {
      path: $determinism_sweep_path,
      sha256: $determinism_sweep_sha256,
      status: $determinism_status,
      iterations: $determinism_iterations
    }
  }' > "$ATTEST_PATH"

cp "$ATTEST_PATH" "$ATTEST_DIR/gate-attestation-${TIMESTAMP//[:]/-}.json"
echo "determinism sweep: $DETERMINISM_SWEEP_PATH"
echo "gate attestation: $ATTEST_PATH"

echo "PASS closure-spine-smoke"
