#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RECEIPT="docs/proofs/wave17-merge-review-render.latest.md"

[[ -f "$RECEIPT" ]] || { echo "ERROR: missing merge-review-render proof receipt: $RECEIPT" >&2; exit 2; }

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

require_literal "$RECEIPT" 'npm run -s wave17:merge-review:render:golden'
require_literal "$RECEIPT" 'npm run -s wave17:merge-review:render:must-reject'
require_literal "$RECEIPT" 'npm run -s check:merge-review-render-contract'
require_literal "$RECEIPT" 'ok wave17 merge review render golden'
require_literal "$RECEIPT" 'ok wave17 merge review render must-reject'
require_literal "$RECEIPT" 'ok merge review render contract guard'

echo "ok wave17 merge review render proof receipt guard"
