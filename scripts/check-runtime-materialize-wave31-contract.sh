#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/runtime-materialize-wave31-golden.sh
bash scripts/runtime-materialize-wave31-must-reject.sh

echo "ok runtime materialize wave31 contract"
