#!/usr/bin/env bash
set -euo pipefail

DIST=""
METHOD=""
MINISIGN_KEY_FILE=""
MINISIGN_KEY_STDIN="0"
MINISIGN_KEY_B64=""
MINISIGN_KEY_URL=""
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
    --minisign-key-file)
      MINISIGN_KEY_FILE="$2"; shift 2 ;;
    --minisign-key-stdin)
      MINISIGN_KEY_STDIN="1"; shift ;;
    --minisign-key-b64)
      MINISIGN_KEY_B64="$2"; shift 2 ;;
    --minisign-key-url)
      MINISIGN_KEY_URL="$2"; shift 2 ;;
    --allow-remote-key)
      ALLOW_REMOTE_KEY="1"; shift ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      exit 2 ;;
  esac
done

if [[ -z "$DIST" || -z "$METHOD" ]]; then
  echo "usage: release-sign.sh --dist <dir> --method <minisign|cosign|gpg> [options]" >&2
  exit 2
fi

if [[ ! -d "$DIST" ]]; then
  echo "ERROR: dist missing: $DIST" >&2
  exit 2
fi

case "$METHOD" in
  minisign)
    command -v minisign >/dev/null 2>&1 || { echo "ERROR: minisign not found" >&2; exit 2; }
    key_source_count=0
    [[ -n "$MINISIGN_KEY_FILE" ]] && key_source_count=$((key_source_count + 1))
    [[ "$MINISIGN_KEY_STDIN" == "1" ]] && key_source_count=$((key_source_count + 1))
    [[ -n "$MINISIGN_KEY_B64" ]] && key_source_count=$((key_source_count + 1))
    [[ -n "$MINISIGN_KEY_URL" ]] && key_source_count=$((key_source_count + 1))
    if [[ "$key_source_count" -gt 1 ]]; then
      echo "ERROR: choose only one minisign key source" >&2
      exit 2
    fi

    minisign_args=("-Sm" "$DIST/checksums.txt")
    if [[ -n "$MINISIGN_KEY_FILE" ]]; then
      minisign_args+=("-s" "$MINISIGN_KEY_FILE")
    elif [[ "$MINISIGN_KEY_STDIN" == "1" ]]; then
      stdin_key_file="$(make_temp_file)"
      cat >"$stdin_key_file"
      minisign_args+=("-s" "$stdin_key_file")
    elif [[ -n "$MINISIGN_KEY_B64" ]]; then
      b64_key_file="$(make_temp_file)"
      if ! printf "%s" "$MINISIGN_KEY_B64" | base64 --decode >"$b64_key_file" 2>/dev/null; then
        echo "ERROR: invalid minisign key base64 payload" >&2
        exit 2
      fi
      minisign_args+=("-s" "$b64_key_file")
    elif [[ -n "$MINISIGN_KEY_URL" ]]; then
      url_key_file="$(make_temp_file)"
      fetch_remote_file "$MINISIGN_KEY_URL" "$url_key_file"
      minisign_args+=("-s" "$url_key_file")
    fi
    minisign "${minisign_args[@]}"
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
