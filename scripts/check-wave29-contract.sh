#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/wave29-golden.sh
bash scripts/wave29-must-reject.sh

echo "ok wave29 contract guard"
