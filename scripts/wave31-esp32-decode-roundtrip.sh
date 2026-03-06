#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SURFACE="dev-docs/wave30/evidence-surface.chords.v0.json"
EMITTER="dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson"
BIN_NONE="dev-docs/wave30/evidence-surface.uart.esp32.v0.bin"
GOLDEN_RECEIPT="dev-docs/wave31/golden/hardware-decode-receipt.v0.json"
GOLDEN_VERIFY="dev-docs/wave31/golden/frame-verify-result.v0.json"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

OUT_RECEIPT="$TMP_DIR/receipt.json"
OUT_VERIFY="$TMP_DIR/verify.json"
OUT_PACKETS="$TMP_DIR/decoded.ndjson"

node tools/mv-evidence-surface/index.js wave31-verify \
  --surface "$SURFACE" \
  --emitter "$EMITTER" \
  --uart-crc none \
  --in-bin "$BIN_NONE" \
  --receipt-out "$OUT_RECEIPT" \
  --verify-out "$OUT_VERIFY"

cmp -s "$OUT_RECEIPT" "$GOLDEN_RECEIPT" || { echo "ERROR: wave31 decode receipt golden mismatch" >&2; exit 2; }
cmp -s "$OUT_VERIFY" "$GOLDEN_VERIFY" || { echo "ERROR: wave31 frame verify golden mismatch" >&2; exit 2; }

node tools/mv-evidence-surface/index.js decode-esp32-uart \
  --surface "$SURFACE" \
  --emitter "$EMITTER" \
  --uart-crc none \
  --in-bin "$BIN_NONE" \
  --out "$OUT_PACKETS"

node --input-type=module - "$OUT_RECEIPT" "$OUT_VERIFY" "$OUT_PACKETS" <<'NODE'
import fs from "fs";
import { canonicalJson, shaPref } from "./tools/wave28-poly-lib.js";

const [receiptPath, verifyPath, packetsPath] = process.argv.slice(2);
const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
const verify = JSON.parse(fs.readFileSync(verifyPath, "utf8"));
const raw = fs.readFileSync(packetsPath, "utf8");
if (!raw.endsWith("\n")) throw new Error("decoded packets NDJSON missing trailing newline");
const rows = raw.trimEnd().split("\n").map((line) => JSON.parse(line));
const digest = shaPref(Buffer.from(rows.map((r) => canonicalJson(r)).join(""), "utf8"));
if (receipt.packet_stream_digest !== digest) throw new Error("receipt packet_stream_digest mismatch");
if (verify.frame_type !== "wave30.evidence_surface_emitter_frame.esp32.v0") throw new Error("verify frame_type mismatch");
if (receipt.decode_ok !== "1") throw new Error("decode_ok must be 1");
if (verify.verify_ok !== "1") throw new Error("verify_ok must be 1");
NODE

echo "ok wave31 esp32 decode roundtrip"
