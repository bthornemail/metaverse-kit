#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/wave17-merge-review-render-golden.sh
bash scripts/wave17-merge-review-render-must-reject.sh

echo "ok merge review render contract guard"
