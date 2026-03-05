#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Targeted gate for this slice: validator behavior and artifact compatibility.
# Full client build currently has pre-existing unrelated TS issues in baseline.
node_modules/.bin/tsc -p apps/client/tsconfig.wave28.json --noEmit
npm run -s check:client:wave28-fixtures
node_modules/.bin/tsx --tsconfig apps/client/tsconfig.json apps/client/src/wave28/validators.test.ts
node_modules/.bin/tsx --tsconfig apps/client/tsconfig.json apps/client/src/wave28/panel-smoke.test.ts
node_modules/.bin/tsx --tsconfig apps/client/tsconfig.json apps/client/src/wave28/panel-render-smoke.test.tsx

echo "ok client wave28 panel guard"
