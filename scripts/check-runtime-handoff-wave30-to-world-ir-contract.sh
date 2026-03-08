#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOC="docs/WAVE30_TO_WORLD_IR_MAPPING.md"

[[ -f "$DOC" ]] || { echo "ERROR: missing mapping doc: $DOC" >&2; exit 2; }

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

require_literal "$DOC" '# WAVE30 to world.ir.v0 Mapping'
require_literal "$DOC" '`build-world-ir-wave30`'
require_literal "$DOC" '`world` must be `wave30-surface-v0`'
require_literal "$DOC" 'authority: `advisory`'
require_literal "$DOC" 'surface_digest'
require_literal "$DOC" 'frame_stream_digest'
require_literal "$DOC" 'packet_stream_digest'
require_literal "$DOC" 'Wave31 verification digests are verification-only metadata'
require_literal "$DOC" 'unknown keys'
require_literal "$DOC" 'must reject'

bash scripts/runtime-handoff-wave30-to-world-ir-golden.sh
bash scripts/runtime-handoff-wave30-to-world-ir-must-reject.sh

echo "ok runtime handoff wave30 to world.ir contract"
