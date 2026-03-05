#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

D1="docs/WAVE28_ZERO_POLY_BASIS_ABI.md"
D2="docs/WAVE28_CLOSED_CONFIG_ABI.md"
D3="docs/WAVE28_POLY_DECOMP_ABI.md"
SPEC="docs/PROTOCOL_SPEC.md"
INDEX="docs/index.md"

for p in "$D1" "$D2" "$D3" "$SPEC" "$INDEX"; do
  [[ -f "$p" ]] || { echo "ERROR: missing required Wave28 doc: $p" >&2; exit 2; }
done

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

require_literal "$D1" 'wave28.zero_poly_basis.v0'
require_literal "$D1" 'authority` must be `advisory'
require_literal "$D1" 'field` must be `F2'
require_literal "$D2" 'wave28.closed_config.v0'
require_literal "$D2" 'authority` must be `advisory'
require_literal "$D2" 'matrix_layout_id = "wave28.matrix_layout.core6.v0"'
require_literal "$D2" 'wave28.constraints.v0'
require_literal "$D2" 'wave28.carrier_state.v0'
require_literal "$D3" 'wave28.poly_decomp.v0'
require_literal "$D3" 'authority` must be `advisory'
require_literal "$D3" 'decompose_algorithm_id = "wave28.decompose.gauss_f2.v0"'
require_literal "$D3" 'norm_id = "wave28.poly_norm.bitmask_lex.v0"'
require_literal "$D3" 'reject on mismatch even if the artifact digest was recomputed'

require_literal "$SPEC" 'docs/WAVE28_ZERO_POLY_BASIS_ABI.md'
require_literal "$SPEC" 'docs/WAVE28_CLOSED_CONFIG_ABI.md'
require_literal "$SPEC" 'docs/WAVE28_POLY_DECOMP_ABI.md'
require_literal "$INDEX" 'Wave28 Zero Poly Basis ABI: `docs/WAVE28_ZERO_POLY_BASIS_ABI.md`'
require_literal "$INDEX" 'Wave28 Closed Config ABI: `docs/WAVE28_CLOSED_CONFIG_ABI.md`'
require_literal "$INDEX" 'Wave28 Poly Decomp ABI: `docs/WAVE28_POLY_DECOMP_ABI.md`'

# Ban ambiguity language in semantic docs.
if rg -n 'Alternative implementations may be used|implementation-defined|may vary' "$D1" "$D2" "$D3" >/dev/null; then
  echo "ERROR: ambiguous wording found in Wave28 docs" >&2
  exit 2
fi

# In Wave28 semantics, "recommended" is treated as soft/ambiguous wording and is disallowed.
if rg -n '\brecommended\b' "$D1" "$D2" "$D3" >/dev/null; then
  echo "ERROR: non-frozen wording found in Wave28 docs: recommended" >&2
  exit 2
fi

# Parse-level checks for frozen IDs/constants to prevent doc drift.
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

count_exact "$D2" 'wave28.matrix_layout.core6.v0' 2
count_exact "$D3" 'wave28.decompose.gauss_f2.v0' 2
count_exact "$D3" 'wave28.poly_norm.bitmask_lex.v0' 2

# Parse-level checks for exact artifact keyset bullets.
for k in v authority field variables basis basis_order digest; do
  require_literal "$D1" "- \`$k\`"
done
for k in v authority basis_digest constraints_digest carrier_state_digest matrix_layout_id matrix_digest non_degenerate digest; do
  require_literal "$D2" "- \`$k\`"
done
for k in v authority basis_digest closed_config_digest input_poly coeff_vector residual_poly norm_id digest; do
  require_literal "$D3" "- \`$k\`"
done

echo "ok wave28 doc freeze guard"
