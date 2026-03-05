#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

say() { echo "==> $*" >&2; }
die() { echo "ERROR: $*" >&2; exit 2; }

LOCK="docs/termux/env.lock.json"
if [[ ! -f "$LOCK" ]]; then
  die "missing $LOCK (run: npm run -s termux:freeze)"
fi

# Hard requirements (stable across devices): tool presence and major versions.
need_cmds=(node npm git python3 make clang jq)
for c in "${need_cmds[@]}"; do
  command -v "$c" >/dev/null 2>&1 || die "missing required command: $c"
done

node_major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [[ "$node_major" -lt 18 ]]; then
  die "node >= 18 required; got $(node -v)"
fi

say "lock file exists; validating that current env matches recorded versions"
python3 - <<'PY' "$LOCK"
import json, subprocess, sys

def cmd(args):
  return subprocess.check_output(args).decode('utf-8', 'replace').strip()

lock = json.load(open(sys.argv[1], "r", encoding="utf-8"))

pairs = {
  "node": cmd(["node", "-v"]),
  "npm": cmd(["npm", "-v"]),
}

mismatch = []
for k, v in pairs.items():
  if lock.get(k) != v:
    mismatch.append((k, lock.get(k), v))

if mismatch:
  for k, want, got in mismatch:
    print(f"ERROR: {k} mismatch lock={want!r} current={got!r}", file=sys.stderr)
  sys.exit(2)

print("ok termux env verified")
PY
