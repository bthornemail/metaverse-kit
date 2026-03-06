#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOC="docs/LAYER_CONTRACT_RUNTIME_HANDOFF_METAVERSE_BUILD.md"

[[ -f "$DOC" ]] || { echo "ERROR: missing runtime handoff contract: $DOC" >&2; exit 2; }

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

# Required section headings
require_literal "$DOC" "## 1. Purpose"
require_literal "$DOC" "## 2. Authority posture"
require_literal "$DOC" "## 3. Accepted handoff form"
require_literal "$DOC" "## 4. Named schema/interface"
require_literal "$DOC" "## 5. Loader/materializer contract"
require_literal "$DOC" "## 6. Must-not-cross boundaries"
require_literal "$DOC" "## 7. Verification points"
require_literal "$DOC" "## 8. Failure behavior"
require_literal "$DOC" "## 9. Immediate implementation target"
require_literal "$DOC" "## 10. Test scenarios"

# Primary decision and interface pins
require_literal "$DOC" '- `projection bundle` (default and required for governed runtime path)'
require_literal "$DOC" '- `event stream` (derived/optional; accepted only when explicitly enabled by profile)'
require_literal "$DOC" '- `raw state snapshot` (debug/recovery only; never default ingest path)'
require_literal "$DOC" '- `world.ir.v0` projection bundle (JSON object validated against `metaverse-build/world-ir/ir.schema.json`)'

# Stage mapping pins
require_literal "$DOC" '- `metaverse-build/world-ir/ir.schema.json`'
require_literal "$DOC" '- `metaverse-build/runtime/world/load-ir.sh`'
require_literal "$DOC" '- `metaverse-build/runtime/world/materialize.py`'
require_literal "$DOC" '- `metaverse-build/runtime/world/apply-event.py`'

# Fail-closed pins
require_literal "$DOC" '- schema mismatch'
require_literal "$DOC" '- digest mismatch'
require_literal "$DOC" '- ordering mismatch'
require_literal "$DOC" '- unknown type/version'
require_literal "$DOC" '- ambiguous projection payload'

# Keep wording unambiguous for governance docs.
if rg -n 'Alternative implementations may be used|implementation-defined|may vary' "$DOC" >/dev/null; then
  echo "ERROR: ambiguous wording found in runtime handoff contract" >&2
  exit 2
fi

echo "ok runtime handoff contract guard"
