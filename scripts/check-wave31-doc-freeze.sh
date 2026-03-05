#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

D1="docs/WAVE31_HARDWARE_DECODE_RECEIPT_ABI.md"
D2="docs/WAVE31_FRAME_VERIFY_RESULT_ABI.md"
SPEC="docs/PROTOCOL_SPEC.md"
INDEX="docs/index.md"

for p in "$D1" "$D2" "$SPEC" "$INDEX"; do
  [[ -f "$p" ]] || { echo "ERROR: missing required Wave31 doc: $p" >&2; exit 2; }
done

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

require_literal "$D1" 'Type: `wave31.hardware_decode_receipt.v0`.'
require_literal "$D1" 'decode_profile_id = "wave31.decode_profile.esp32_uart.v0"'
require_literal "$D1" '`authority` must be `advisory`'
require_literal "$D1" '`uart_crc` must be `none` or `crc8-xor-v0`'
require_literal "$D1" '`packet_stream_digest` must reference canonical NDJSON digest of decoded `wave30.evidence_surface_uart_packet.esp32.v0` stream'
require_literal "$D1" '`decode_ok` must be `0` or `1`'
require_literal "$D1" '`decode_ok=1` with `error_count != 0`'

require_literal "$D2" 'Type: `wave31.frame_verify_result.v0`.'
require_literal "$D2" 'frame_verify_id = "wave31.frame_verify.leds240.v0"'
require_literal "$D2" '`authority` must be `advisory`'
require_literal "$D2" '`frame_type` must be `wave30.evidence_surface_emitter_frame.esp32.v0`'
require_literal "$D2" '`verify_ok` must be `0` or `1`'
require_literal "$D2" '`verify_ok=1` with `mismatch_count != 0`'

for k in v authority decode_profile_id surface_digest packet_stream_digest uart_crc packet_count decode_ok error_count first_error_code digest; do
  require_literal "$D1" "- \`$k\`"
done
for k in v authority frame_verify_id frame_type surface_digest frame_stream_digest frame_count verify_ok mismatch_count first_mismatch_t digest; do
  require_literal "$D2" "- \`$k\`"
done

if rg -n 'Alternative implementations may be used|implementation-defined|may vary|\brecommended\b' "$D1" "$D2" >/dev/null; then
  echo "ERROR: ambiguous wording found in Wave31 docs" >&2
  exit 2
fi

require_literal "$SPEC" 'docs/WAVE31_HARDWARE_DECODE_RECEIPT_ABI.md'
require_literal "$SPEC" 'docs/WAVE31_FRAME_VERIFY_RESULT_ABI.md'
require_literal "$INDEX" 'Wave31 Hardware Decode Receipt ABI: `docs/WAVE31_HARDWARE_DECODE_RECEIPT_ABI.md`'
require_literal "$INDEX" 'Wave31 Frame Verify Result ABI: `docs/WAVE31_FRAME_VERIFY_RESULT_ABI.md`'

echo "ok wave31 doc freeze guard"
