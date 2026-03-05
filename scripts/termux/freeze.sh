#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

say() { echo "==> $*" >&2; }
die() { echo "ERROR: $*" >&2; exit 2; }

if ! command -v pkg >/dev/null 2>&1; then
  die "pkg not found"
fi

LOCK="docs/termux/env.lock.json"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

say "collect termux environment"
python3 - <<'PY' "$TMP"
import json, os, platform, subprocess, sys

def cmd(args):
  try:
    return subprocess.check_output(args, stderr=subprocess.STDOUT).decode('utf-8', 'replace').strip()
  except Exception as e:
    return f"<error:{e}>"

out = {
  "schema": "metaverse-kit.termux_env_lock.v0",
  "prefix": os.environ.get("PREFIX", ""),
  "uname": cmd(["uname", "-a"]),
  "arch": platform.machine(),
  "python": cmd(["python3", "--version"]),
  "node": cmd(["node", "-v"]),
  "npm": cmd(["npm", "-v"]),
  "tsc": cmd(["npx", "--yes", "tsc", "-v"]),
  "pkg_installed": cmd(["pkg", "list-installed"]),
}

with open(sys.argv[1], "w", encoding="utf-8", newline="\n") as f:
  json.dump(out, f, sort_keys=True, separators=(",", ":"))
  f.write("\n")
PY

mv "$TMP" "$LOCK"
say "wrote $LOCK"
