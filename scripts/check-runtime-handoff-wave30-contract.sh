#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/check-runtime-handoff-wave30-to-world-ir-contract.sh

echo "ok runtime handoff wave30 contract"
