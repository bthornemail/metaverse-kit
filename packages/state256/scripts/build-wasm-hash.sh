#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WAT_PATH="${ROOT_DIR}/wasm/hash-kernel.wat"
WAT_SIMD_PATH="${ROOT_DIR}/wasm/hash-kernel-simd.wat"
WASM_PATH="${ROOT_DIR}/wasm/hash-kernel.wasm"

if ! command -v wat2wasm >/dev/null 2>&1; then
  echo "wat2wasm is required to build ${WASM_PATH}" >&2
  exit 1
fi

if wat2wasm --help 2>&1 | grep -q "enable-simd"; then
  wat2wasm --enable-simd "${WAT_SIMD_PATH}" -o "${WASM_PATH}"
  echo "Wrote ${WASM_PATH} (simd)"
else
  wat2wasm "${WAT_PATH}" -o "${WASM_PATH}"
  echo "Wrote ${WASM_PATH} (scalar)"
fi
