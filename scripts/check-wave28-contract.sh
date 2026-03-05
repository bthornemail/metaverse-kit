#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/wave28-golden.sh
bash scripts/wave28-must-reject.sh

echo "ok wave28 contract guard"
