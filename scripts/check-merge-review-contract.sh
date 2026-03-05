#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/wave17-merge-review-golden.sh
bash scripts/wave17-merge-review-must-reject.sh

echo "ok merge review contract guard"
