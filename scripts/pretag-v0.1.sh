#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { echo "==> $*" >&2; }
die() { echo "ERROR: $*" >&2; exit 2; }

cd "$ROOT"

# Hard guard: placeholder key must be removed before any release gate runs.
if grep -Fq "REPLACE_WITH_REAL_PUBLIC_KEY" keys/active.json; then
  die "keys/active.json still contains placeholder public key"
fi

# Optional: enforce clean tree so the tag is unambiguous.
# Comment out if you sometimes run pretag while iterating locally.
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "working tree not clean (commit or stash before pretag)"
fi

# Optional: enforce you are on main (or your release branch).
branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  say "warning: not on main (on $branch)"
fi

say "1/9 check: active key (placeholder must be removed)"
npm run -s check:active-key

say "2/9 check: portal contract"
npm run -s check:portal-contract

say "3/9 demo portal eval"
bash scripts/demo-portal-eval.sh

say "4/9 release pack"
npm run -s release:pack

say "5/9 release verify"
npm run -s release:verify

say "6/9 release SBOM + provenance"
npm run -s release:sbom

say "7/9 docker transport envelope build"
npm run -s release:docker

say "8/9 docker transport smoke"
npm run -s release:docker-smoke

say "9/9 summarize key digests"
DIST="dist/metaverse-kit-v0.1"
if [[ -d "$DIST" ]]; then
  if [[ -f "$DIST/demo.bundle/manifest.json" ]]; then
    say "manifest.json sha256:"
    sha256sum "$DIST/demo.bundle/manifest.json" | awk '{print "  "$0}' >&2
  fi
  if [[ -f "$DIST/checksums.txt" ]]; then
    say "checksums.txt sha256:"
    sha256sum "$DIST/checksums.txt" | awk '{print "  "$0}' >&2
  fi
  if [[ -f "$DIST/docker-image.txt" ]]; then
    say "docker image digest:"
    sed 's/^/  /' "$DIST/docker-image.txt" >&2
  fi
else
  die "missing dist directory: $DIST"
fi

say "OK pretag gates passed"
