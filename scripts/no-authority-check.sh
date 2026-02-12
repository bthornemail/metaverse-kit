#!/usr/bin/env bash
set -euo pipefail

# metaverse-kit must remain a Projector/Consumer: no authority append logic.
# This is an entrypoint-focused gate: scan what actually runs (CI, package scripts,
# repo scripts). We intentionally do not scan docs/markdown.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

pattern='(\bport-matroid-tool\b|\bappend-envelope\b|\bingest-segment\b|\bselect-fork\b|\bgc-forks\b|\bappend-to-port-matroid\b|\bulp-core\b|\bvalidate-segment\b|PM_ROOT\b)'

files=()
SELF="$ROOT/scripts/no-authority-check.sh"
for f in \
  "$ROOT/package.json" \
  "$ROOT/Makefile" "$ROOT/makefile" "$ROOT/justfile" "$ROOT/Justfile" \
  ; do
  [ -f "$f" ] && files+=("$f")
done

if [ -d "$ROOT/.github/workflows" ]; then
  while IFS= read -r -d '' f; do files+=("$f"); done < <(find "$ROOT/.github/workflows" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) -print0)
fi

if [ -d "$ROOT/scripts" ]; then
  while IFS= read -r -d '' f; do
    [ "$f" = "$SELF" ] && continue
    files+=("$f")
  done < <(find "$ROOT/scripts" -type f -print0)
fi

hits=""
if [ "${#files[@]}" -gt 0 ]; then
  hits="$(rg -n --no-messages "$pattern" "${files[@]}" || true)"
fi

if [ -n "$hits" ]; then
  echo "metaverse-kit authority gate failed: found append/reconcile/ingest usage:" >&2
  echo "$hits" >&2
  exit 1
fi

echo "ok metaverse-kit no-authority gate"
