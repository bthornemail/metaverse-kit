#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

B1="$TMP/demo1.bundle"
B2="$TMP/demo2.bundle"
P1="$TMP/proposal.json"
ACTIONS="$TMP/actions.json"
TAMPER="$TMP/demo1.tampered"

story="$ROOT/../Shape Signature/golden/story_bundle/mini.story_bundle.json"
world="$ROOT/../Shape Signature/golden/civic_world_graph/mini.civic_world_graph.json"
events="$ROOT/../Shape Signature/golden/civic_event_log/mini.civic_event_log.ndjson"
multiview="$ROOT/../Shape Signature/golden/multiview_manifest/mini.multiview_manifest.json"
harmonic="$ROOT/../Shape Signature/golden/wave15_harmonic/mini.harmonic.ndjson"
observer="$ROOT/../Shape Signature/golden/wave15_harmonic/observer_profile_default.v0.json"

ms() {
  python3 - <<'PY'
import time
print(int(time.time()*1000))
PY
}

echo "[eval] deterministic replay test"
t0="$(ms)"
node "$ROOT/tools/mv-pack-demo/index.js" --story "$story" --world "$world" --events "$events" --multiview "$multiview" --harmonic "$harmonic" --observer-profile "$observer" --out "$B1" --force --include-portal >/dev/null
node "$ROOT/tools/mv-pack-demo/index.js" --story "$story" --world "$world" --events "$events" --multiview "$multiview" --harmonic "$harmonic" --observer-profile "$observer" --out "$B2" --force --include-portal >/dev/null

d1="$(cat "$B1/integrity.sha256" | tr -d '\n')"
d2="$(cat "$B2/integrity.sha256" | tr -d '\n')"
if [ "$d1" != "$d2" ]; then
  echo "ERROR: deterministic replay test failed: $d1 != $d2" >&2
  exit 1
fi
node "$ROOT/tools/mv-verify-demo/index.js" --bundle "$B1" >/dev/null
node "$ROOT/tools/mv-verify-demo/index.js" --bundle "$B2" >/dev/null

t1="$(ms)"


echo "[eval] integrity failure test"
cp -a "$B1" "$TAMPER"
python3 - "$TAMPER/canonical/story_bundle.json" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1])
b=p.read_bytes()
p.write_bytes(b+b'X')
PY
if node "$ROOT/tools/mv-verify-demo/index.js" --bundle "$TAMPER" >/tmp/mv-verify-demo.out 2>&1; then
  echo "ERROR: integrity failure test did not fail closed" >&2
  cat /tmp/mv-verify-demo.out >&2
  exit 1
fi
rg -n "asset digest mismatch|asset size mismatch" /tmp/mv-verify-demo.out >/dev/null || {
  echo "ERROR: integrity failure test missing expected error" >&2
  cat /tmp/mv-verify-demo.out >&2
  exit 1
}
t2="$(ms)"


echo "[eval] proposal export test"
cat > "$ACTIONS" <<'JSON'
[
  {
    "kind": "annotate_node",
    "target": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    "payload": {"source": "portal", "tag": "selected", "value": "1"}
  }
]
JSON
base="$(cat "$B1/integrity.sha256" | tr -d '\n')"
node "$ROOT/tools/mv-proposal-bundle/index.js" emit --base-bundle-digest "$base" --author "portal:local" --actions "$ACTIONS" --out "$P1" >/dev/null
node "$ROOT/tools/mv-proposal-bundle/index.js" validate --proposal "$P1" >/dev/null
python3 - "$P1" "$base" <<'PY'
import json,sys
p=json.load(open(sys.argv[1],encoding='utf-8'))
base=sys.argv[2]
if p['base_bundle_digest']!=base:
    raise SystemExit('base_bundle_digest mismatch')
if p['summary']['authority']!='advisory':
    raise SystemExit('authority not advisory')
print('ok proposal binding')
PY

t3="$(ms)"

echo "[eval] performance trace (ms)"
echo "pack+verify_determinism: $((t1-t0))"
echo "integrity_failure_check: $((t2-t1))"
echo "proposal_emit_validate: $((t3-t2))"
echo "total: $((t3-t0))"

echo "ok demo portal eval"
