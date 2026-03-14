#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Downstream must use only the stable public package boundary.
if rg -n --glob '!scripts/check-atomic-kernel-import-boundary.sh' 'runtime\.atomic_kernel\.' tools scripts fixtures docs packages apps >/dev/null 2>&1; then
  echo "ERROR: forbidden internal atomic-kernel import path found (runtime.atomic_kernel.*)" >&2
  exit 2
fi

if ! rg -n '^\s*import\s+atomic_kernel\s+as\s+ak\b' tools/mv-atomic-kernel/index.py >/dev/null 2>&1; then
  echo "ERROR: adapter must import public atomic_kernel API" >&2
  exit 2
fi

echo "ok atomic-kernel import boundary"
