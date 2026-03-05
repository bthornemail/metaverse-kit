#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/wave30-uart-decode-roundtrip.sh
bash scripts/wave30-uart-decode-must-reject.sh

echo "ok wave30 uart decode contract guard"
