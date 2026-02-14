#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_REL="dist/metaverse-kit-v0.1"
DIST="$ROOT_DIR/$DIST_REL"

if [[ ! -d "$DIST" ]]; then
  echo "ERROR: missing release directory: $DIST" >&2
  echo "Run: npm run -s release:pack" >&2
  exit 2
fi

echo
echo "== External tester verification demo =="
sleep 1

echo
echo "1) Verify checksums"
sleep 1
(
  cd "$DIST"
  sha256sum --check checksums.txt
)
sleep 2

echo
echo "2) Verify bundle integrity"
sleep 1
(
  cd "$ROOT_DIR"
  npm run -s mv-verify-demo -- --bundle "$DIST_REL/demo.bundle"
)
sleep 2

echo
echo "3) Deterministic replay smoke"
sleep 1
(
  cd "$ROOT_DIR"
  npm run -s external:tester-smoke -- --dist "$DIST_REL"
)
sleep 2

echo
echo "== Demo complete: bundle verified =="
sleep 2
