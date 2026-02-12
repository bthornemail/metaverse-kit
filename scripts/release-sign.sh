#!/usr/bin/env bash
set -euo pipefail

DIST=""
METHOD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dist)
      DIST="$2"; shift 2 ;;
    --method)
      METHOD="$2"; shift 2 ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      exit 2 ;;
  esac
done

if [[ -z "$DIST" || -z "$METHOD" ]]; then
  echo "usage: release-sign.sh --dist <dir> --method <minisign|cosign|gpg>" >&2
  exit 2
fi

if [[ ! -d "$DIST" ]]; then
  echo "ERROR: dist missing: $DIST" >&2
  exit 2
fi

case "$METHOD" in
  minisign)
    command -v minisign >/dev/null 2>&1 || { echo "ERROR: minisign not found" >&2; exit 2; }
    minisign -Sm "$DIST/checksums.txt"
    ;;
  cosign)
    command -v cosign >/dev/null 2>&1 || { echo "ERROR: cosign not found" >&2; exit 2; }
    cosign sign-blob --yes --output-signature "$DIST/checksums.txt.sig" "$DIST/checksums.txt"
    ;;
  gpg)
    command -v gpg >/dev/null 2>&1 || { echo "ERROR: gpg not found" >&2; exit 2; }
    gpg --armor --detach-sign --output "$DIST/checksums.txt.asc" "$DIST/checksums.txt"
    ;;
  *)
    echo "ERROR: unsupported method: $METHOD" >&2
    exit 2
    ;;
esac

echo "ok release-sign method=$METHOD dist=$DIST"
