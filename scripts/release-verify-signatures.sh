#!/usr/bin/env bash
set -euo pipefail

DIST=""
METHOD=""
MINISIGN_PUBKEY=""
MINISIGN_PUBKEY_FILE=""
MINISIGN_PUBKEY_URL=""
ALLOW_REMOTE_KEY="0"

TMP_FILES=()
cleanup() {
  local f
  for f in "${TMP_FILES[@]:-}"; do
    [[ -n "$f" && -f "$f" ]] && rm -f "$f"
  done
}
trap cleanup EXIT

make_temp_file() {
  local t
  t="$(mktemp)"
  TMP_FILES+=("$t")
  printf "%s" "$t"
}

fetch_remote_file() {
  local url="$1"
  local out="$2"
  if [[ "$ALLOW_REMOTE_KEY" != "1" ]]; then
    echo "ERROR: remote key source requires --allow-remote-key" >&2
    exit 2
  fi
  if [[ ! "$url" =~ ^https:// ]]; then
    echo "ERROR: remote key URL must use https://" >&2
    exit 2
  fi
  if command -v curl >/dev/null 2>&1; then
    curl --fail --silent --show-error --location "$url" --output "$out"
    return
  fi
  if command -v wget >/dev/null 2>&1; then
    wget --quiet --output-document="$out" "$url"
    return
  fi
  echo "ERROR: curl or wget required for remote key fetch" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dist)
      DIST="$2"; shift 2 ;;
    --method)
      METHOD="$2"; shift 2 ;;
    --minisign-pubkey)
      MINISIGN_PUBKEY="$2"; shift 2 ;;
    --minisign-pubkey-file)
      MINISIGN_PUBKEY_FILE="$2"; shift 2 ;;
    --minisign-pubkey-url)
      MINISIGN_PUBKEY_URL="$2"; shift 2 ;;
    --allow-remote-key)
      ALLOW_REMOTE_KEY="1"; shift ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      exit 2 ;;
  esac
done

if [[ -z "$DIST" || -z "$METHOD" ]]; then
  echo "usage: release-verify-signatures.sh --dist <dir> --method <minisign|cosign|gpg> [options]" >&2
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
    pubkey_source_count=0
    [[ -n "$MINISIGN_PUBKEY" ]] && pubkey_source_count=$((pubkey_source_count + 1))
    [[ -n "$MINISIGN_PUBKEY_FILE" ]] && pubkey_source_count=$((pubkey_source_count + 1))
    [[ -n "$MINISIGN_PUBKEY_URL" ]] && pubkey_source_count=$((pubkey_source_count + 1))
    if [[ "$pubkey_source_count" -gt 1 ]]; then
      echo "ERROR: choose only one minisign pubkey source" >&2
      exit 2
    fi

    if [[ -n "$MINISIGN_PUBKEY" ]]; then
      minisign -Vm "$DIST/checksums.txt" -P "$MINISIGN_PUBKEY"
    elif [[ -n "$MINISIGN_PUBKEY_FILE" ]]; then
      minisign -Vm "$DIST/checksums.txt" -p "$MINISIGN_PUBKEY_FILE"
    elif [[ -n "$MINISIGN_PUBKEY_URL" ]]; then
      url_pubkey_file="$(make_temp_file)"
      fetch_remote_file "$MINISIGN_PUBKEY_URL" "$url_pubkey_file"
      minisign -Vm "$DIST/checksums.txt" -p "$url_pubkey_file"
    else
      echo "INFO: minisign verification requires -P <pubkey>."
      echo "Run: minisign -Vm $DIST/checksums.txt -P '<pubkey>'"
    fi
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
