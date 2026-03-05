#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/wave30-frames-golden.sh
bash scripts/wave30-frames-must-reject.sh

echo "ok wave30 frames contract guard"
