#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CLOSURE_RECEIPT="docs/proofs/closure-spine-smoke.latest.md"
W29_RECEIPT="docs/proofs/wave29.latest.md"

for p in "$CLOSURE_RECEIPT" "$W29_RECEIPT"; do
  [[ -f "$p" ]] || { echo "ERROR: missing Wave29 proof receipt file: $p" >&2; exit 2; }
done

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

require_pattern() {
  local file="$1"
  local pat="$2"
  grep -Eq -- "$pat" "$file" || { echo "ERROR: missing pattern in $file: $pat" >&2; exit 2; }
}

# Closure receipt must include Wave29 spine labels and final success line.
require_pattern "$CLOSURE_RECEIPT" '^WARN: no passing snapshot found for inputs_digest=sha256:[0-9a-f]{64}$'
require_literal "$CLOSURE_RECEIPT" '[8a6m/9] metaverse-kit: wave29 golden'
require_literal "$CLOSURE_RECEIPT" '[8a6n/9] metaverse-kit: wave29 must-reject'
require_literal "$CLOSURE_RECEIPT" 'ok closure spine smoke'

# Wave29 receipt must include stable gate success lines.
require_literal "$W29_RECEIPT" 'ok wave29 doc freeze guard'
require_literal "$W29_RECEIPT" 'ok wave29 golden'
require_literal "$W29_RECEIPT" 'ok wave29 must-reject'
require_literal "$W29_RECEIPT" 'ok wave29 contract guard'

echo "ok wave29 proof receipt guard"
