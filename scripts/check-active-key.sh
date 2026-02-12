#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

python3 - <<'PY'
import json
from pathlib import Path

active_path = Path("keys/active.json")
history_path = Path("keys/history.json")

if not active_path.exists():
    raise SystemExit("ERROR: missing keys/active.json")
if not history_path.exists():
    raise SystemExit("ERROR: missing keys/history.json")

active = json.loads(active_path.read_text())
history = json.loads(history_path.read_text())

if not isinstance(history, list) or len(history) == 0:
    raise SystemExit("ERROR: keys/history.json must be a non-empty array")

active_keys = set(active.keys())
if active_keys != {"version", "key_id", "public_key", "valid_from", "replaces"}:
    raise SystemExit("ERROR: keys/active.json keyset mismatch")

if not isinstance(active["version"], str) or not active["version"].isdigit():
    raise SystemExit("ERROR: active.version must be decimal string")
if not isinstance(active["key_id"], str) or not active["key_id"]:
    raise SystemExit("ERROR: active.key_id invalid")
if not isinstance(active["public_key"], str) or not active["public_key"]:
    raise SystemExit("ERROR: active.public_key invalid")
if not isinstance(active["valid_from"], str) or len(active["valid_from"]) != 10:
    raise SystemExit("ERROR: active.valid_from must be YYYY-MM-DD")
if active["replaces"] is not None and not isinstance(active["replaces"], str):
    raise SystemExit("ERROR: active.replaces must be string|null")

seen = set()
for i, entry in enumerate(history):
    if not isinstance(entry, dict):
        raise SystemExit(f"ERROR: history[{i}] must be object")
    if set(entry.keys()) != {"key_id", "status", "reason"}:
        raise SystemExit(f"ERROR: history[{i}] keyset mismatch")
    if not isinstance(entry["key_id"], str) or not entry["key_id"]:
        raise SystemExit(f"ERROR: history[{i}].key_id invalid")
    if entry["key_id"] in seen:
        raise SystemExit(f"ERROR: duplicate key_id in history: {entry['key_id']}")
    seen.add(entry["key_id"])
    if entry["status"] not in {"active", "retired", "revoked"}:
        raise SystemExit(f"ERROR: history[{i}].status invalid")
    if not isinstance(entry["reason"], str):
        raise SystemExit(f"ERROR: history[{i}].reason must be string")

last = history[-1]
if last["status"] != "active":
    raise SystemExit("ERROR: last history entry must be active")
if active["key_id"] != last["key_id"]:
    raise SystemExit("ERROR: active.key_id must match last history entry")

if len(history) == 1:
    if active["replaces"] is not None:
        raise SystemExit("ERROR: active.replaces must be null for first key")
else:
    prev = history[-2]["key_id"]
    if active["replaces"] != prev:
        raise SystemExit("ERROR: active.replaces must equal previous key_id")

print("OK: active key lineage")
PY
