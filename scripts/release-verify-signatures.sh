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
  echo "usage: release-verify-signatures.sh --dist <dir> --method <minisign|cosign|gpg>" >&2
  exit 2
fi

if [[ ! -d "$DIST" ]]; then
  echo "ERROR: dist missing: $DIST" >&2
  exit 2
fi

case "$METHOD" in
  minisign)
    command -v minisign >/dev/null 2>&1 || { echo "ERROR: minisign not found" >&2; exit 2; }
    [[ -f "$DIST/checksums.txt.minisig" ]] || { echo "ERROR: minisign signature missing" >&2; exit 2; }
    echo "INFO: minisign verification requires -P <pubkey>."
    echo "Run: minisign -Vm $DIST/checksums.txt -P '<pubkey>'"
    ;;
  cosign)
    command -v cosign >/dev/null 2>&1 || { echo "ERROR: cosign not found" >&2; exit 2; }
    [[ -f "$DIST/checksums.txt.sig" ]] || { echo "ERROR: cosign signature missing" >&2; exit 2; }
    echo "INFO: cosign verification requires identity/key settings."
    echo "Run: cosign verify-blob --signature $DIST/checksums.txt.sig $DIST/checksums.txt"
    ;;
  gpg)
    command -v gpg >/dev/null 2>&1 || { echo "ERROR: gpg not found" >&2; exit 2; }
    [[ -f "$DIST/checksums.txt.asc" ]] || { echo "ERROR: gpg signature missing" >&2; exit 2; }
    gpg --verify "$DIST/checksums.txt.asc" "$DIST/checksums.txt"
    ;;
  *)
    echo "ERROR: unsupported method: $METHOD" >&2
    exit 2
    ;;
esac

echo "ok release-verify-signatures method=$METHOD dist=$DIST"
