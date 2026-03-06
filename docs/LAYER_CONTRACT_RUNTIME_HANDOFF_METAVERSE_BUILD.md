# Layer Contract: Runtime Handoff into metaverse-build (Informative-First)

## 1. Purpose

Define the single designated handoff from the runtime bridge into `metaverse-build`.

## 2. Authority posture

- `metaverse-build` consumes handoff objects/streams.
- `metaverse-build` does not define handoff semantics.
- Handoff meaning remains anchored in `metaverse-kit` law and the designated bridge path from `docs/LAYER_CONTRACT_RUNTIME_BRIDGE.md`.

## 3. Accepted handoff form

Primary handoff form:

- `projection bundle` (default and required for governed runtime path)

Secondary handoff form:

- `event stream` (derived/optional; accepted only when explicitly enabled by profile)

Non-default handoff form:

- `raw state snapshot` (debug/recovery only; never default ingest path)

## 4. Named schema/interface

Primary interface name:

- `world.ir.v0` projection bundle (JSON object validated against `metaverse-build/world-ir/ir.schema.json`)

Required fields (v0 baseline):

- As required by `world-ir/ir.schema.json` (minimum required key: `world`)

Ordering rules:

- Projection bundle objects use canonical JSON ordering for digest/equivalence.
- Event streams (secondary) preserve line order as authoritative sequence for replay.

Digest rules:

- Handoff artifacts are hashed using canonical JSON bytes (UTF-8, sorted keys, no extra whitespace, single trailing newline when serialized for hash).
- Any declared digest must match recomputed digest before materialization.

Equivalence rules:

- Two handoff artifacts are equivalent when canonical digest matches, or when replay/materialization yields equivalent runtime state under deterministic comparison.

## 5. Loader/materializer contract

Designated stage mapping (current candidate path):

- `metaverse-build/world-ir/ir.schema.json`
  - Defines accepted IR object shape.
  - Must only validate shape and required keys; must not add semantic defaults.
- `metaverse-build/runtime/world/load-ir.sh`
  - Loads validated IR into runtime workflow.
  - Must orchestrate stage calls and emit deterministic report paths only.
- `metaverse-build/runtime/world/materialize.py`
  - Materializes IR into runtime snapshot + seed trace deterministically.
  - Must not reinterpret upstream semantic meaning beyond declared schema/rules.
- `metaverse-build/runtime/world/apply-event.py`
  - Applies event stream onto snapshot with authority checks.
  - Must fail closed on unknown event type, missing required fields, or authority violations.

## 6. Must-not-cross boundaries

- Loader must not invent missing semantic fields.
- Materializer must not reinterpret canonical meaning.
- Runtime must reject invalid handoff; it must never silently repair malformed payloads.
- Projection/runtime defaults must not become canonical truth.
- Secondary/non-default handoff forms must not override the primary `projection bundle` contract.

## 7. Verification points

- Pre-handoff: schema validation + digest validation (when digest declared).
- Post-load: equivalence check between accepted handoff artifact and loaded runtime representation.
- Post-materialization: runtime conformance signal (deterministic snapshot/replay hash or equivalent deterministic proof).

## 8. Failure behavior

Fail closed on:

- schema mismatch
- digest mismatch
- ordering mismatch
- unknown type/version
- ambiguous projection payload

Expected behavior on fail:

- halt materialization for that handoff
- emit explicit error label/reason
- produce zero authoritative downstream mutation

## 9. Immediate implementation target

Primary target now:

- `world.ir.v0` projection bundle into:
  - `world-ir/ir.schema.json` -> `runtime/world/load-ir.sh` -> `runtime/world/materialize.py`

Secondary (non-default) targets:

- event stream path via `runtime/world/apply-event.py`
- raw snapshot path for recovery/debug only

## 10. Test scenarios

Minimum required scenarios:

- valid projection bundle loads and materializes deterministically
- reordered payload rejects (where ordering is part of accepted contract)
- digest mismatch rejects
- missing required field rejects
- runtime output can be compared back to handoff artifact through deterministic equivalence/hash check

## Public interfaces/types impact

- No protocol ABI changes in this step.
- Freezes runtime handoff selection and stage contract language.
- Future follow-up may add executable guard script/workflow for this contract.

## Assumptions and defaults chosen

- Home repo: `metaverse-kit/docs`
- Normative posture: informative-first, then CI-enforced
- Primary handoff decision: `projection bundle`
- Secondary decision: `event stream`
- Non-default decision: `raw state snapshot`
