#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

AUTH_DOC="docs/LAYER_CONTRACT_AUTHORITY_METAVERSE_KIT.md"
APP_DOC="docs/apps/LAYER_CONTRACT_PROJECTION_APPS.md"

for p in "$AUTH_DOC" "$APP_DOC"; do
  [[ -f "$p" ]] || { echo "ERROR: missing layer contract file: $p" >&2; exit 2; }
done

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

require_literal "$AUTH_DOC" '- Layer: doctrine + ir'
require_literal "$AUTH_DOC" '- Authority class: authoritative'
require_literal "$AUTH_DOC" '- Name: `metaverse-kit authority surface`'
require_literal "$AUTH_DOC" "## Forbidden Behavior"
require_literal "$AUTH_DOC" 'Must not move canonical authority into `apps/*`, `portal/*`, or projection adapters.'

require_literal "$APP_DOC" '- Layer: projection'
require_literal "$APP_DOC" '- Authority class: advisory'
require_literal "$APP_DOC" '- Name: `metaverse-kit apps projection shell`'
require_literal "$APP_DOC" "## Forbidden Behavior"
require_literal "$APP_DOC" 'Must not mutate canonical artifacts directly from UI state.'

# Keep wording unambiguous for governance docs.
if rg -n 'Alternative implementations may be used|implementation-defined|may vary' "$AUTH_DOC" "$APP_DOC" >/dev/null; then
  echo "ERROR: ambiguous wording found in layer contract docs" >&2
  exit 2
fi

echo "ok layer contract guard"
