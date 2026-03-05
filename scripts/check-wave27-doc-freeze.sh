#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOC_ABI="docs/WAVE27_POINTER_SYNC_ABI.md"
DOC_FUN="docs/WAVE27_POINTER_SYNC_FUNCTIONS.md"
DOC_SPINE="docs/WAVE27_TRACE_SPINE_ABI.md"
DOC_SPEC="docs/PROTOCOL_SPEC.md"
DOC_INDEX="docs/index.md"

for p in "$DOC_ABI" "$DOC_FUN" "$DOC_SPINE" "$DOC_SPEC" "$DOC_INDEX"; do
  [[ -f "$p" ]] || { echo "ERROR: missing required Wave27 doc: $p" >&2; exit 2; }
done

require_literal() {
  local file="$1"
  local literal="$2"
  grep -Fq "$literal" "$file" || {
    echo "ERROR: missing literal in $file: $literal" >&2
    exit 2
  }
}

# IDs must be present verbatim in function freeze doc.
require_literal "$DOC_FUN" 'turn_clock_id = "wave27.turn_clock.delta12.v0"'
require_literal "$DOC_FUN" 'turn_project_id = "wave27.turn_project.delta12_line_res.v0"'
require_literal "$DOC_FUN" 'reflect_id = "wave27.reflect.parity_p.v0"'

# Delta table must match exact frozen constants.
require_literal "$DOC_FUN" 'Δ(k,0) = [1,3,5,7,11,13]'
require_literal "$DOC_FUN" 'Δ(k,1) = [2,4,6,8,12,14]'
require_literal "$DOC_FUN" 'DELTA_C241_0=[1,3,5,7,11,13]'
require_literal "$DOC_FUN" 'DELTA_C241_1=[2,4,6,8,12,14]'
require_literal "$DOC_FUN" 'B_LINE=[17,19,23,29,31,37]'
require_literal "$DOC_FUN" 'B_RES=[41,43,47,53,59,61]'

# b_line and b_res tables must match exact frozen constants.
for lit in 'k=1→17' 'k=2→19' 'k=3→23' 'k=4→29' 'k=5→31' 'k=6→37'; do
  require_literal "$DOC_FUN" "$lit"
done
for lit in 'k=1→41' 'k=2→43' 'k=3→47' 'k=4→53' 'k=5→59' 'k=6→61'; do
  require_literal "$DOC_FUN" "$lit"
done

# Fingerprint freeze must be explicit and verbatim.
require_literal "$DOC_FUN" 'ring_fingerprint == ring_basis.digest'

# Must-reject semantics for unknown IDs and table drift must be present.
require_literal "$DOC_FUN" 'unknown `turn_clock_id`, `turn_project_id`, or `reflect_id`'
require_literal "$DOC_FUN" 'any `Δ`, `b_line`, or `b_res` entry differs from this file'
require_literal "$DOC_ABI" 'unknown/missing function IDs'

# Ensure docs are wired into index + protocol spec.
require_literal "$DOC_SPEC" 'docs/WAVE27_POINTER_SYNC_ABI.md'
require_literal "$DOC_SPEC" 'docs/WAVE27_POINTER_SYNC_FUNCTIONS.md'
require_literal "$DOC_SPEC" 'docs/WAVE27_TRACE_SPINE_ABI.md'
require_literal "$DOC_INDEX" 'Wave27 Pointer Sync ABI: `docs/WAVE27_POINTER_SYNC_ABI.md`'
require_literal "$DOC_INDEX" 'Wave27 Pointer Sync Functions: `docs/WAVE27_POINTER_SYNC_FUNCTIONS.md`'
require_literal "$DOC_INDEX" 'Wave27 Trace Spine ABI: `docs/WAVE27_TRACE_SPINE_ABI.md`'

# No ambiguity language allowed in frozen Wave27 docs.
if rg -n 'Alternative implementations may be used' "$DOC_ABI" "$DOC_FUN" "$DOC_SPINE" >/dev/null; then
  echo "ERROR: ambiguous wording found in Wave27 docs: 'Alternative implementations may be used'" >&2
  exit 2
fi
if rg -n 'may vary|implementation-defined|for example|recommended' "$DOC_ABI" "$DOC_FUN" "$DOC_SPINE" >/dev/null; then
  echo "ERROR: ambiguous wording found in Wave27 docs: one of [may vary, implementation-defined, for example, recommended]" >&2
  exit 2
fi

# Parse check: read only machine-parse constants block.
python3 - "$DOC_FUN" <<'PY'
import re, sys
p = sys.argv[1]
t = open(p, encoding='utf-8').read()

block = re.search(
    r'## Frozen Constants Block \(machine-parse\)\s+```txt\s+(.+?)\s+```',
    t,
    re.S
)
if not block:
    print('ERROR: missing Frozen Constants Block (machine-parse)', file=sys.stderr)
    sys.exit(2)

payload = block.group(1)
rows = {}
for line in payload.splitlines():
    line = line.strip()
    if not line:
        continue
    if '=' not in line:
        print(f'ERROR: invalid constants line: {line}', file=sys.stderr)
        sys.exit(2)
    key, val = line.split('=', 1)
    key = key.strip()
    val = val.strip()
    nums = re.findall(r'\d+', val)
    rows[key] = nums

expected = {
    'DELTA_C241_0': ['1','3','5','7','11','13'],
    'DELTA_C241_1': ['2','4','6','8','12','14'],
    'B_LINE': ['17','19','23','29','31','37'],
    'B_RES': ['41','43','47','53','59','61'],
}
if set(rows.keys()) != set(expected.keys()):
    print(f'ERROR: constants keys mismatch: got={sorted(rows.keys())}', file=sys.stderr)
    sys.exit(2)

for k, exp in expected.items():
    got = rows.get(k, [])
    if got != exp:
        print(f'ERROR: {k} mismatch: {got}', file=sys.stderr)
        sys.exit(2)

print('ok wave27 table parse check')
PY

echo "ok wave27 doc freeze guard"
