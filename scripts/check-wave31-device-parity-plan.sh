#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOC="docs/WAVE31_DEVICE_PARITY_HARNESS.md"
SHAPE="dev-docs/wave31/device-parity/README.md"

for p in "$DOC" "$SHAPE"; do
  [[ -f "$p" ]] || { echo "ERROR: missing Wave31 parity plan file: $p" >&2; exit 2; }
done

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

require_literal "$DOC" "## Device Input Contract"
require_literal "$DOC" "## Device Output Contract"
require_literal "$DOC" "## Parity Rule"
require_literal "$DOC" "## Fail-Closed Reject Classes"
require_literal "$DOC" "## I/O Channel Contract (Frozen Abstract Form)"
require_literal "$DOC" "decode_profile_id = \"wave31.decode_profile.esp32_uart.v0\""
require_literal "$DOC" "frame_verify_id = \"wave31.frame_verify.leds240.v0\""
require_literal "$DOC" "frame_type = \"wave30.evidence_surface_emitter_frame.esp32.v0\""
require_literal "$DOC" "uart_crc = \"none\" | \"crc8-xor-v0\""
require_literal "$DOC" "authority: advisory"
require_literal "$DOC" "truncated packet stream"
require_literal "$DOC" "trailing bytes after final packet boundary"
require_literal "$DOC" "invalid transport marker/header bytes"
require_literal "$DOC" "invalid packet length/framing"
require_literal "$DOC" 'CRC mismatch when `uart_crc=crc8-xor-v0`'
require_literal "$DOC" 'reordered packet stream (`t` sequence mismatch)'

if rg -n 'Alternative implementations may be used|implementation-defined|may vary|\brecommended\b' "$DOC" >/dev/null; then
  echo "ERROR: ambiguous wording found in Wave31 parity harness doc" >&2
  exit 2
fi

require_literal "$SHAPE" "W31_DEVICE_PORT"
require_literal "$SHAPE" "W31_DEVICE_BAUD"
require_literal "$SHAPE" "W31_DEVICE_TIMEOUT_MS"

echo "ok wave31 device parity plan guard"
