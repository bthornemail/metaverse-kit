#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DIST=""
VERIFY_SIGNATURES="0"
SIG_METHOD=""
MINISIGN_PUBKEY=""
MINISIGN_PUBKEY_FILE=""
MINISIGN_PUBKEY_URL=""
ALLOW_REMOTE_KEY="0"

usage() {
  cat >&2 <<'EOF'
usage: external-tester-smoke.sh [options]

options:
  --dist <dir>                     release dir (default: dist/metaverse-kit-v0.1)
  --verify-signatures              verify signature artifacts
  --signature-method <m>           minisign|gpg|cosign (required with --verify-signatures)
  --minisign-pubkey <base64>       minisign public key for verification
  --minisign-pubkey-file <path>    minisign public key file
  --minisign-pubkey-url <https>    minisign public key URL (requires --allow-remote-key)
  --allow-remote-key               explicit opt-in for remote key fetch
EOF
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dist)
      DIST="$2"; shift 2 ;;
    --verify-signatures)
      VERIFY_SIGNATURES="1"; shift ;;
    --signature-method)
      SIG_METHOD="$2"; shift 2 ;;
    --minisign-pubkey)
      MINISIGN_PUBKEY="$2"; shift 2 ;;
    --minisign-pubkey-file)
      MINISIGN_PUBKEY_FILE="$2"; shift 2 ;;
    --minisign-pubkey-url)
      MINISIGN_PUBKEY_URL="$2"; shift 2 ;;
    --allow-remote-key)
      ALLOW_REMOTE_KEY="1"; shift ;;
    --help|-h)
      usage ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      usage ;;
  esac
done

if [[ -z "$DIST" ]]; then
  DIST="dist/metaverse-kit-v0.1"
fi

if [[ ! -d "$DIST" ]]; then
  echo "ERROR: dist missing: $DIST" >&2
  exit 2
fi

echo "[1/4] checksum + bundle verification"
bash scripts/verify-release.sh --dist "$DIST"

if [[ "$VERIFY_SIGNATURES" == "1" ]]; then
  if [[ -z "$SIG_METHOD" ]]; then
    echo "ERROR: --signature-method is required with --verify-signatures" >&2
    exit 2
  fi
  echo "[2/4] signature verification ($SIG_METHOD)"
  verify_cmd=(bash scripts/release-verify-signatures.sh --dist "$DIST" --method "$SIG_METHOD")
  if [[ "$SIG_METHOD" == "minisign" ]]; then
    [[ -n "$MINISIGN_PUBKEY" ]] && verify_cmd+=(--minisign-pubkey "$MINISIGN_PUBKEY")
    [[ -n "$MINISIGN_PUBKEY_FILE" ]] && verify_cmd+=(--minisign-pubkey-file "$MINISIGN_PUBKEY_FILE")
    [[ -n "$MINISIGN_PUBKEY_URL" ]] && verify_cmd+=(--minisign-pubkey-url "$MINISIGN_PUBKEY_URL")
    [[ "$ALLOW_REMOTE_KEY" == "1" ]] && verify_cmd+=(--allow-remote-key)
  fi
  "${verify_cmd[@]}"
else
  echo "[2/4] signature verification skipped (pass --verify-signatures to enable)"
fi

echo "[3/4] deterministic replay smoke"
node tools/mv-verify-demo/index.js --bundle "$DIST/demo.bundle"

echo "[4/4] deterministic proposal export smoke"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
base_digest="$(tr -d '\r\n' < "$DIST/demo.bundle/integrity.sha256")"
node tools/mv-proposal-bundle/index.js \
  emit \
  --base-bundle-digest "$base_digest" \
  --author external-tester \
  --actions docs/templates/proposal-actions.sample.json \
  --out "$tmp_dir/proposal.json"
node tools/mv-proposal-bundle/index.js \
  emit \
  --base-bundle-digest "$base_digest" \
  --author external-tester \
  --actions docs/templates/proposal-actions.sample.json \
  --out "$tmp_dir/proposal-second.json"
node tools/mv-proposal-bundle/index.js validate --proposal "$tmp_dir/proposal.json"
cmp -s "$tmp_dir/proposal.json" "$tmp_dir/proposal-second.json" || {
  echo "ERROR: proposal export is not deterministic" >&2
  exit 2
}
echo "ok external tester smoke dist=$DIST"
