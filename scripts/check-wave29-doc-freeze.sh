#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

D1="docs/WAVE29_ACTION_PLAN_ABI.md"
D2="docs/WAVE29_ACTION_PLAN_FUNCTIONS.md"
SPEC="docs/PROTOCOL_SPEC.md"
INDEX="docs/index.md"

for p in "$D1" "$D2" "$SPEC" "$INDEX"; do
  [[ -f "$p" ]] || { echo "ERROR: missing required Wave29 doc: $p" >&2; exit 2; }
done

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

require_literal "$D1" 'Type: `wave29.action_plan.v0`.'
require_literal "$D1" 'plan_map_id` must be `wave29.plan_map.poly_to_wave20.v0'
require_literal "$D1" 'plan_norm_id` must be `wave29.plan_norm.step_lex.v0'
require_literal "$D1" 'authority` must be `advisory'
require_literal "$D1" 'FOCUS_CLUSTER'
require_literal "$D1" 'TRACE_LINEAGE'

require_literal "$D2" 'plan_map_id = "wave29.plan_map.poly_to_wave20.v0"'
require_literal "$D2" 'plan_norm_id = "wave29.plan_norm.step_lex.v0"'
require_literal "$D2" 'If mapping cannot proceed deterministically, emit no action and fail-closed validation.'

# Ensure canonical cross-doc binding is present.
require_literal "$D1" '`input_poly` and `residual_poly` use canonical polynomial format from Wave28 basis ABI'

# Keyset bullets must exist exactly.
for k in v authority plan_map_id plan_norm_id inputs actions notes digest; do
  require_literal "$D1" "- \`$k\`"
done
for k in v digest; do
  require_literal "$D1" "- \`$k\`"
done
for k in step verb params evidence; do
  require_literal "$D1" "- \`$k\`"
done
for k in bitmask degree source_poly target; do
  require_literal "$D1" "- \`$k\`"
done
for k in code detail; do
  require_literal "$D1" "- \`$k\`"
done

# Ban ambiguous wording in semantic docs.
if rg -n 'Alternative implementations may be used|implementation-defined|may vary|\brecommended\b' "$D1" "$D2" >/dev/null; then
  echo "ERROR: ambiguous wording found in Wave29 docs" >&2
  exit 2
fi

# Parse-level count checks for frozen IDs.
count_exact() {
  local file="$1"
  local lit="$2"
  local expected="$3"
  local got
  got="$(grep -Foc "$lit" "$file" || true)"
  [[ "$got" == "$expected" ]] || {
    echo "ERROR: expected $expected occurrence(s) of '$lit' in $file, got $got" >&2
    exit 2
  }
}

count_exact "$D2" 'wave29.plan_map.poly_to_wave20.v0' 2
count_exact "$D2" 'wave29.plan_norm.step_lex.v0' 2

# Wiring checks.
require_literal "$SPEC" 'docs/WAVE29_ACTION_PLAN_ABI.md'
require_literal "$SPEC" 'docs/WAVE29_ACTION_PLAN_FUNCTIONS.md'
require_literal "$INDEX" 'Wave29 Action Plan ABI: `docs/WAVE29_ACTION_PLAN_ABI.md`'
require_literal "$INDEX" 'Wave29 Action Plan Functions: `docs/WAVE29_ACTION_PLAN_FUNCTIONS.md`'

echo "ok wave29 doc freeze guard"
