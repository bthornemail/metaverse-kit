#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

KEY_DOC="docs/KEY_ROTATION.md"
INC_DOC="docs/INCIDENT_RESPONSE.md"

TRANSPORT_ATTEST="${TRANSPORT_ATTEST_PATH:-/home/main/devops/metaverse-build/evidence/pre-hardware/transport-equivalence.attestation.v0.json}"
OPS_ATTEST="${OPS_ATTEST_PATH:-/home/main/devops/metaverse-build/evidence/pre-hardware/ops-rollback-restore-drill.attestation.v0.json}"

require_literal() {
  local file="$1"
  local lit="$2"
  grep -Fq -- "$lit" "$file" || { echo "ERROR: missing literal in $file: $lit" >&2; exit 2; }
}

[[ -f "$KEY_DOC" ]] || { echo "ERROR: missing key rotation doc: $KEY_DOC" >&2; exit 2; }
[[ -f "$INC_DOC" ]] || { echo "ERROR: missing incident response doc: $INC_DOC" >&2; exit 2; }

require_literal "$KEY_DOC" "$TRANSPORT_ATTEST"
require_literal "$KEY_DOC" "$OPS_ATTEST"
require_literal "$INC_DOC" "$TRANSPORT_ATTEST"
require_literal "$INC_DOC" "$OPS_ATTEST"
require_literal "$INC_DOC" "check-federated-transport-equivalence.sh"
require_literal "$INC_DOC" "check-ops-rollback-restore-drill.sh"
require_literal "$KEY_DOC" "runtime attestation digests"
require_literal "$INC_DOC" "attestation digests captured"

[[ -f "$TRANSPORT_ATTEST" ]] || { echo "ERROR: missing runtime attestation artifact: $TRANSPORT_ATTEST" >&2; exit 2; }
[[ -f "$OPS_ATTEST" ]] || { echo "ERROR: missing runtime attestation artifact: $OPS_ATTEST" >&2; exit 2; }

if rg -n '(best effort|implementation-defined|may vary|optional enforcement)' "$KEY_DOC" "$INC_DOC" >/dev/null; then
  echo "ERROR: ambiguous wording found in ops attestation docs" >&2
  exit 2
fi

echo "ok ops attestation contract"
