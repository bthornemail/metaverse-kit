#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node_modules/.bin/tsx --tsconfig apps/client/tsconfig.json apps/client/src/wave28/fixtures-contract.test.ts

echo "ok client wave28 fixtures guard"
