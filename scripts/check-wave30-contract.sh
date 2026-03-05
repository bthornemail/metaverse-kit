#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/wave30-golden.sh
bash scripts/wave30-must-reject.sh
bash scripts/check-wave30-frames-contract.sh
bash scripts/check-wave30-emitter-contract.sh
bash scripts/check-wave30-uart-contract.sh
bash scripts/check-wave30-uart-decode-contract.sh

echo "ok wave30 contract guard"
