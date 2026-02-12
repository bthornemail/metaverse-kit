#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DIST=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dist)
      DIST="$2"
      shift 2
      ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$DIST" ]]; then
  DIST="dist/metaverse-kit-v0.1"
fi

if [[ ! -d "$DIST" ]]; then
  echo "ERROR: dist missing: $DIST" >&2
  exit 2
fi

( cd "$DIST" && sha256sum --check checksums.txt )

if [[ ! -d "$DIST/demo.bundle" ]]; then
  echo "ERROR: demo.bundle missing in $DIST" >&2
  exit 2
fi

npm run -s mv-verify-demo -- --bundle "$DIST/demo.bundle"

echo "ok verify-release dist=$DIST"
