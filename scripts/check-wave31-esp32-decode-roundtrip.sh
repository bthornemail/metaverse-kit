#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/wave31-esp32-decode-roundtrip.sh

echo "ok wave31 esp32 decode roundtrip guard"
