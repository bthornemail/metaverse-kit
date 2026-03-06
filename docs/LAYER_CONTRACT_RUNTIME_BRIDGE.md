# Layer Contract: Runtime Bridge (Informative-First)

## 1. Purpose

Define a single constitutional assignment for the canonical artifact-to-state-to-projection bridge into `metaverse-build`, using existing capability pools without semantic drift.

## 2. Authority model

- Canonical law source: `metaverse-kit` only.
- Runtime realization: non-authoritative (`metaverse-build`).
- Adapter-capability families (observer/translator only): `modem-canvas`, `tetragrammatron-os`, `psync*`, and other alternate protocol families.
- Verification suites are read-only adjudicators; they never mutate canonical/runtime truth.

## 3. Six runtime-bridge jobs

Each job declares `Primary`, `Secondary`, `Role Class`, and `Why`.

### [1] Ingest

- Primary: `hardware-os`
- Secondary: `port-matroid`
- Role Class: non-authoritative ingest/replay boundary
- Why: deterministic intake, validation, and trace discipline at the boundary.

### [2] Replay/Reduce

- Primary: `port-matroid`
- Secondary: `hardware-os`
- Role Class: designated reducer realization path
- Why: deterministic replay/snapshot law and replay-oriented conformance surface.

### [3] Runtime State Container

- Primary: `hardware-os`
- Secondary: `ulp-core-invariant`
- Role Class: designated runtime state container
- Why: explicit kernel/runtime state boundary for deterministic realization of the designated reducer path.

### [4] Projection/Adapters

- Primary: `geometry-spine` + `port-lattice`
- Secondary: `metaverse-kit` projection tools
- Role Class: projection/transport realization only
- Why: projection and transport are downstream views/plumbing and must remain non-authoritative.

### [5] Execution Host

- Primary: `metaverse-build`
- Secondary: none
- Role Class: authority-gated live runtime host
- Why: designated runtime/hypervisor layer for execution orchestration without protocol-law redefinition.

### [6] Verify/Introspect

- Primary: `ulp-core-invariant` + `waveform-core`
- Secondary: `ulp-compat-suite`
- Role Class: conformance/equivalence/mismatch reporting
- Why: independent replay/verification and drift detection without write authority.

## 4. Recommended package assignment

Recommended current bridge assembly:

- [1] Ingest: `hardware-os` (fallback `port-matroid`)
- [2] Replay/Reduce: `port-matroid` (fallback `hardware-os`)
- [3] Runtime State Container: `hardware-os` (fallback `ulp-core-invariant`)
- [4] Projection/Adapters: `geometry-spine` + `port-lattice` (fallback `metaverse-kit` projection tools)
- [5] Execution Host: `metaverse-build`
- [6] Verify/Introspect: `ulp-core-invariant` + `waveform-core` (fallback `ulp-compat-suite`)

## 5. Dependency direction

Canonical direction:

```text
metaverse-kit (law)
  -> ingest
  -> reducer
  -> state
  -> projection
  -> metaverse-build
  -> clients
```

Side-read and plug points:

- Verification reads from ingest/reducer/state/projection/runtime outputs.
- Transport plugs at the projection boundary only.
- Compatibility suites observe artifacts and outputs; they do not define semantics.
- The ingest->reducer->state->projection chain is the designated realization path, not a new authority source.
- Canonical meaning remains anchored in `metaverse-kit` law.

## 6. Must-not-cross boundaries

- `metaverse-build` must not redefine Wave semantics.
- Projection/adapters must not author canonical state.
- Transport layers must not invent or mutate semantic state.
- Verification layers must not mutate runtime truth.
- Alternate protocol families must stay behind adapters only; no direct semantic override of Wave law.

## 7. Alternate candidates / substitutions

Controlled substitutions are allowed only under explicit trigger conditions:

- Use secondary only if primary lacks required interface, performance, or scope.
- Any substitution requires an explicit compatibility note tied to Wave artifacts and deterministic proof evidence.
- No substitution may change the authority class of a job.

## 8. Open risks

- Semantic drift risk between multiple reducer-capable projects.
- Hidden authority creep via transport/projection convenience paths.
- Adapter leakage from alternate families into canonical law path.
- Incomplete handoff contract into `metaverse-build` (object/stream schema ambiguity).

## 9. Immediate implementation recommendation

- Publish this as an informative-first contract in `metaverse-kit/docs`.
- Keep one explicit canonical path sequence with named package interfaces.
- Maintain an observer-only register for non-authoritative families.
- Follow-up PR: add CI guard that checks required headings, must-not-cross literals, and recommended assignment literals.
- Immediate follow-up: freeze the projection/handoff contract into `metaverse-build` as a named interface (event stream, state snapshot, or projection bundle).

## 10. Reuse candidates by file/module

Best current bridge (ranked recommendation):

- Ingest
  - Primary: `hardware-os/tools/hd`
  - Secondary: `port-matroid/app/port-matroid-tool/Main.hs` (`validate`, envelope append/verify flows)
- Reducer
  - Primary: `port-matroid/src/Snapshot/Reconcile/Core.hs`
  - Secondary: `ulp-core-invariant/src/ULP/Core/Reducer.hs`
- Canonical/runtime state container
  - Primary: `hardware-os` manifest/layer model (`schemas/kernel/**`, `docs/STATE_MACHINE_SPEC.md`)
  - Secondary: `ulp-core-invariant/src/ULP/Core/Types.hs`
- Projection/adapters
  - Primary: `geometry-spine/rpc/mcp-gateway/mcp-server.js` + `port-lattice/runtime/lattice`
  - Secondary: `metaverse-kit` projection packages (`packages/shadow-canvas/src/index.ts`, `packages/state256/src/index.ts`) and Wave surface tools
- Runtime handoff into `metaverse-build`
  - Primary: `metaverse-build/world-ir/ir.schema.json` -> `runtime/world/load-ir.sh` -> `runtime/world/materialize.py`/`apply-event.py`
  - Secondary: `metaverse-build/pipelines/identity-trace-authority-sync-rpc.sh` + `pipelines/adapter-replay/run.sh`
- Verification/conformance
  - Primary: `ulp-core-invariant/app/ulp-core.hs` (`verify`, segment/ingest/equivocation/reconcile commands) + `waveform-core/app/waveform-analyze/Main.hs`
  - Secondary: `ulp-compat-suite/scripts/*`, `metaverse-kit` wave guards, and `metaverse-build/docs/golden-tests.md` flow

Named package bridge entrypoints inside `metaverse-kit` law surface:

- Ingestion/validation boundary: `packages/protocol/src/index.ts`, `packages/addr/src/index.ts`, `packages/tilestore/src/index.ts`
- Deterministic replay/reducer: `packages/shadow-canvas/src/index.ts` (`buildState`, `applyEvent`, `sortEventsDeterministic`)
- Normalization/equivalence: `packages/nf/src/index.ts` (`orderEventsDeterministic`, `traceHash`, `normalizeState`, `stateHash`, `equivalentStates`)
- Canonical state and projection routing: `packages/state256/src/index.ts` (`AtomVM`, `runProgram`, `routeProjection`)
- Adapter/projection support: `packages/ext32/src/index.ts`, `packages/basis32/src/index.ts`, `packages/discovery/src/index.ts`

Observer-only capability register (non-authoritative families):

- `modem-canvas` (`src/server.js`, `src/stream.js`) for strict NDJSON gateway/projection patterns
- `tetragrammatron-os` (`tools/canbc/*.js`, `components/can_vm/can_vm.c`) for VM/bytecode and deterministic reducer patterns
- `matroid-garden` (`runtime/browser-v1/*.js`, `runtime/posix-haskell/src/ULP/*.hs`) for NDJSON runtime/merge/projection patterns
- `universal-life-protocol/ulp-v3.0/bin/*` for deterministic shell-based canonicalization/admissibility flows
- `boundary-interior-combinatorial-framework` for math/ISA/reference implementation logic to mine into governed adapters

## 11. Harvest vs wrap vs rewrite decision

Bridge implementation decisions:

- Reuse as-is
  - `metaverse-kit` package entrypoints (`protocol`, `addr`, `tilestore`, `shadow-canvas`, `nf`, `state256`, `ext32`, `basis32`, `discovery`)
  - `metaverse-build` `world-ir` schema + `runtime/world` loader/materializer path as current handoff candidate
- Wrap behind adapters
  - `hardware-os` ingest/state tools, `port-matroid` reducer/reconcile modules, `geometry-spine` and `port-lattice` projection/transport modules, `ulp-core-invariant` verifier
  - `modem-canvas`, `tetragrammatron-os`, `matroid-garden`, `universal-life-protocol` components as observer/projection/reducer capability wrappers only
- Mine logic then rewrite under governed interfaces
  - Any component that carries alternate authority semantics, incompatible envelope/schema assumptions, or implicit side effects
  - Candidate areas: CANBC/CAN-ISA execution semantics, browser-first runtimes, and protocol-family-specific merge logic where direct import would blur Wave law boundaries

## Public interfaces/types impact

- No runtime/protocol schema changes in this step.
- Adds governance-level architecture contract only.
- Future guard enforcement should verify contract wording/coverage without altering wire formats.

## Test cases / validation scenarios

- Contract completeness check: all six jobs have primary, secondary, role class, and rationale.
- Boundary check: each must-not-cross rule appears verbatim.
- Dependency check: one canonical direction graph plus explicit side-read/plug points.
- Recommendation check: selected path resolves "artifact enters -> runtime state in `metaverse-build`" unambiguously.

## Assumptions and defaults chosen

- Home repo: `metaverse-kit/docs`.
- Normative posture now: informative-first; governance-enforced in follow-up.
- `metaverse-build` remains fixed as execution host.
- `modem-canvas` and `tetragrammatron-os` remain adapter-capability families, not default bridge authority.
