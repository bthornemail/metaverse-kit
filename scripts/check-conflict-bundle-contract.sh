#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/wave17-conflict-golden.sh
bash scripts/wave17-conflict-must-reject.sh

echo "ok conflict bundle contract guard"
