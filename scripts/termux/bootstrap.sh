#!/usr/bin/env bash
set -euo pipefail

say() { echo "==> $*" >&2; }
die() { echo "ERROR: $*" >&2; exit 2; }

# This script is intentionally minimal and TERMUX-first.
# It is an environment *bootstrap*, not a protocol layer.

if [[ "${PREFIX:-}" != "/data/data/com.termux/files/usr" ]]; then
  say "warning: PREFIX is not Termux default; continuing anyway"
fi

if ! command -v pkg >/dev/null 2>&1; then
  die "Termux pkg not found (are you in Termux?)"
fi

say "update package index"
pkg update -y

say "install baseline build tools"
# Keep list small and boring; add only if required by builds.
pkg install -y \
  git \
  nodejs-lts \
  python \
  make \
  clang \
  jq \
  openssl-tool \
  coreutils

say "node/npm versions"
node -v >&2
npm -v >&2

say "npm install (locked)"
# npm workspaces install with package-lock.json. Use CI mode for reproducibility.
npm ci

say "ok termux bootstrap"
