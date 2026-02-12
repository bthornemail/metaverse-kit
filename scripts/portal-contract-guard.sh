#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

INDEX_FILE="docs/index.md"
REQUIRED_DOC='`docs/portal-contract.md`'
EVAL_SCRIPT="scripts/demo-portal-eval.sh"

if ! grep -Fq "$REQUIRED_DOC" "$INDEX_FILE"; then
  echo "ERROR: portal contract missing from docs index ($INDEX_FILE)"
  exit 1
fi

changed_files=""
if [[ -n "${PORTAL_GUARD_BASE_REF:-}" ]] && git rev-parse --verify "$PORTAL_GUARD_BASE_REF" >/dev/null 2>&1; then
  changed_files="$(git diff --name-only "$PORTAL_GUARD_BASE_REF...HEAD")"
else
  staged="$(git diff --name-only --cached)"
  if [[ -n "$staged" ]]; then
    changed_files="$staged"
  else
    changed_files="$(git diff --name-only HEAD)"
  fi
fi

if [[ -z "$changed_files" ]]; then
  echo "OK: portal contract guard (no changed files)"
  exit 0
fi

has_portal_change="0"
has_eval_change="0"

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    portal/*|tools/mv-pack-demo/*|tools/mv-verify-demo/*|tools/mv-proposal-bundle/*)
      has_portal_change="1"
      ;;
  esac
  if [[ "$path" == "$EVAL_SCRIPT" ]]; then
    has_eval_change="1"
  fi
done <<< "$changed_files"

if [[ "$has_portal_change" == "1" && "$has_eval_change" != "1" ]]; then
  echo "ERROR: portal-critical files changed without updating $EVAL_SCRIPT"
  echo "       Update $EVAL_SCRIPT to keep deterministic demo evaluation aligned."
  exit 1
fi

echo "OK: portal contract guard"
