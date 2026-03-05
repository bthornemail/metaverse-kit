#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

D1="docs/WAVE30_EVIDENCE_BUNDLE_ABI.md"
D2="docs/WAVE30_EVIDENCE_SURFACE_CHORDS_ABI.md"
D3="docs/WAVE30_EVIDENCE_SURFACE_FUNCTIONS.md"
D4="docs/WAVE30_EVIDENCE_SURFACE_FRAMES_ABI.md"
D5="docs/WAVE30_EVIDENCE_SURFACE_EMITTER_FRAMES_ABI.md"
D6="docs/WAVE30_EVIDENCE_SURFACE_UART_PACKETS_ABI.md"
SPEC="docs/PROTOCOL_SPEC.md"
INDEX="docs/index.md"

for p in "$D1" "$D2" "$D3" "$D4" "$D5" "$D6" "$SPEC" "$INDEX"; do
  [[ -f "$p" ]] || { echo "ERROR: missing required Wave30 doc: $p" >&2; exit 2; }
done

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

require_literal "$D1" 'Type: `wave30.evidence_bundle.v0`.'
require_literal "$D1" 'authority` must be `advisory'
require_literal "$D1" 'evidence_digest` is `sha256(canonical_json(evidence))`'
require_literal "$D2" 'Type: `wave30.evidence_surface.chords.v0`.'
require_literal "$D2" 'ring_size` must be `240`'
require_literal "$D2" '`(p0,d,k_max)` must match frozen extraction rule from `seed_digest`'
require_literal "$D3" 'surface_map_id = "wave30.surface_map.digest_to_chords.v0"'
require_literal "$D3" 'surface_norm_id = "wave30.surface_norm.chord_lex.v0"'
require_literal "$D3" 'Spiral rendering is projection-only and non-canonical.'
require_literal "$D4" 'Type: `wave30.evidence_surface_frame.v0`.'
require_literal "$D4" '`mode` must be `leds240`'
require_literal "$D4" '`chord_on` and `chord_dim` must be disjoint'
require_literal "$D4" 'Pointer precedence rule:'
require_literal "$D5" 'Type: `wave30.evidence_surface_emitter_frame.esp32.v0`.'
require_literal "$D5" '`profile` must be `esp32.v0`'
require_literal "$D5" '`pointer` must be subset of `on`'
require_literal "$D5" '`on` and `dim` must be disjoint'
require_literal "$D5" '`on = sort(unique(pointer_on ∪ chord_on))`'
require_literal "$D6" 'Type: `wave30.evidence_surface_uart_packet.esp32.v0`.'
require_literal "$D6" '`profile` must be `esp32.uart.v0`'
require_literal "$D6" '`uart_crc` must be `none` or `crc8-xor-v0`'
require_literal "$D6" '`packet_bytes` must be `67` when `uart_crc=none`'
require_literal "$D6" '`packet_bytes` must be `68` when `uart_crc=crc8-xor-v0`'
require_literal "$D6" 'Packet bytes are fixed to `67` bytes:'
require_literal "$D6" 'bytes `7..36`: `on` mask, 240 bits (30 bytes), bit `i` => LED `i`'
require_literal "$D6" 'bytes `37..66`: `dim` mask, 240 bits (30 bytes), bit `i` => LED `i`'
require_literal "$D6" 'optional byte `67`: CRC byte when `uart_crc=crc8-xor-v0`'
require_literal "$D6" 'optional `.bin` projection is `concat(packet_bytes in ascending t order)`'
require_literal "$D6" 'when `uart_crc=crc8-xor-v0`, CRC byte is XOR of bytes `0..66`'
require_literal "$D6" '## Decoder Roundtrip Contract'
require_literal "$D6" 'roundtrip parity: `emit -> bin -> decode` equals canonical packet NDJSON'

# Keyset bullets (exact bullets must exist)
for k in v authority subject_digest claim_type evidence evidence_digest digest; do
  require_literal "$D1" "- \`$k\`"
done
for k in v authority seed_digest ring_size p0 d k_max chords_digest digest; do
  require_literal "$D2" "- \`$k\`"
done

if rg -n 'Alternative implementations may be used|implementation-defined|may vary|\brecommended\b' "$D1" "$D2" "$D3" "$D4" "$D5" "$D6" >/dev/null; then
  echo "ERROR: ambiguous wording found in Wave30 docs" >&2
  exit 2
fi

require_literal "$SPEC" 'docs/WAVE30_EVIDENCE_BUNDLE_ABI.md'
require_literal "$SPEC" 'docs/WAVE30_EVIDENCE_SURFACE_CHORDS_ABI.md'
require_literal "$SPEC" 'docs/WAVE30_EVIDENCE_SURFACE_FRAMES_ABI.md'
require_literal "$SPEC" 'docs/WAVE30_EVIDENCE_SURFACE_EMITTER_FRAMES_ABI.md'
require_literal "$SPEC" 'docs/WAVE30_EVIDENCE_SURFACE_UART_PACKETS_ABI.md'
require_literal "$SPEC" 'docs/WAVE30_EVIDENCE_SURFACE_FUNCTIONS.md'
require_literal "$INDEX" 'Wave30 Evidence Bundle ABI: `docs/WAVE30_EVIDENCE_BUNDLE_ABI.md`'
require_literal "$INDEX" 'Wave30 Evidence Surface Chords ABI: `docs/WAVE30_EVIDENCE_SURFACE_CHORDS_ABI.md`'
require_literal "$INDEX" 'Wave30 Evidence Surface Frames ABI: `docs/WAVE30_EVIDENCE_SURFACE_FRAMES_ABI.md`'
require_literal "$INDEX" 'Wave30 Evidence Surface Emitter Frames ABI: `docs/WAVE30_EVIDENCE_SURFACE_EMITTER_FRAMES_ABI.md`'
require_literal "$INDEX" 'Wave30 Evidence Surface UART Packets ABI: `docs/WAVE30_EVIDENCE_SURFACE_UART_PACKETS_ABI.md`'
require_literal "$INDEX" 'Wave30 Evidence Surface Functions: `docs/WAVE30_EVIDENCE_SURFACE_FUNCTIONS.md`'

echo "ok wave30 doc freeze guard"
