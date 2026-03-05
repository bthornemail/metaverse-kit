#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/wave27-pointer-sync-golden.sh
bash scripts/wave27-pointer-sync-must-reject.sh

echo "ok pointer sync contract guard"
