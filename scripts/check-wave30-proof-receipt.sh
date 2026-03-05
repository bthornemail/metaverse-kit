#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CLOSURE_RECEIPT="docs/proofs/closure-spine-smoke.latest.md"
W30_RECEIPT="docs/proofs/wave30.latest.md"

for p in "$CLOSURE_RECEIPT" "$W30_RECEIPT"; do
  [[ -f "$p" ]] || { echo "ERROR: missing Wave30 proof receipt file: $p" >&2; exit 2; }
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

# Closure receipt must include Wave30 labels and final success.
require_pattern "$CLOSURE_RECEIPT" '^WARN: no passing snapshot found for inputs_digest=sha256:[0-9a-f]{64}$'
require_literal "$CLOSURE_RECEIPT" '[8a6o/9] metaverse-kit: wave30 golden'
require_literal "$CLOSURE_RECEIPT" '[8a6p/9] metaverse-kit: wave30 must-reject'
require_literal "$CLOSURE_RECEIPT" '[8a6q/9] metaverse-kit: wave30 frames golden'
require_literal "$CLOSURE_RECEIPT" '[8a6r/9] metaverse-kit: wave30 frames must-reject'
require_literal "$CLOSURE_RECEIPT" '[8a6s/9] metaverse-kit: wave30 emitter golden'
require_literal "$CLOSURE_RECEIPT" '[8a6t/9] metaverse-kit: wave30 emitter must-reject'
require_literal "$CLOSURE_RECEIPT" '[8a6u/9] metaverse-kit: wave30 uart golden'
require_literal "$CLOSURE_RECEIPT" '[8a6v/9] metaverse-kit: wave30 uart must-reject'
require_literal "$CLOSURE_RECEIPT" 'ok closure spine smoke'

# Wave30 receipt must include stable gate success lines.
require_literal "$W30_RECEIPT" 'ring_size=240'
require_literal "$W30_RECEIPT" 'chord(k)={(p0+k*d) mod 240,(p0-k*d) mod 240}'
require_literal "$W30_RECEIPT" 'seed_digest == wave30.evidence_bundle.v0.digest'
require_literal "$W30_RECEIPT" 'ok wave30 doc freeze guard'
require_literal "$W30_RECEIPT" 'ok wave30 golden'
require_literal "$W30_RECEIPT" 'ok wave30 must-reject'
require_literal "$W30_RECEIPT" 'ok wave30 frames contract guard'
require_literal "$W30_RECEIPT" 'ok wave30 emitter contract guard'
require_literal "$W30_RECEIPT" 'ok wave30 uart contract guard'
require_literal "$W30_RECEIPT" 'ok wave30 uart decode contract guard'
require_literal "$W30_RECEIPT" 'ok wave30 contract guard'

echo "ok wave30 proof receipt guard"
