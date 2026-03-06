# Protocol Spec (Working, Frozen-by-Version)

This document is the protocol-facing description of Metaverse Kit’s artifact model. It is intended for implementers, not portal users.

The protocol is an integrity/replay system. UI is an interpreter.

## Authority classes

- `authoritative`: canonical truth (append-only, replayable, verifiable)
- `advisory`: non-authoritative lenses, templates, proposals, telemetry

Portal and projection adapters must never emit authoritative truth. They may emit advisory proposal artifacts only.

## Canonical encoding rules

Unless an ABI says otherwise:

- JSON objects must have strict keysets (unknown keys reject, missing keys reject).
- Leaf scalars must be strings (“string membrane”).
- Digests use `sha256:<64 lowercase hex>`.
- Hash payloads use canonical JSON:
  - UTF-8
  - lexicographic key ordering
  - no extra whitespace
  - ends with exactly one newline (`0x0A`) which is included in the hash

NDJSON logs must be one canonical JSON object per line, newline-terminated, and must not contain trailing bytes after the final newline.

## Protocol surface (Waves 16-30)

The “wave” stack is a set of frozen ABIs + validators that define world structure and closure properties.

### Wave 16: Narrative portal mode

- Narrative state: `wave16.narrative_state.v0`
- Interaction tape: `wave16.interaction_tape.v0`
- Template generator contracts (proposal-only): `wave16.template_generator.v0`
- Proposal output: `wave16.proposal_bundle.v0` (advisory, quarantined)

Docs:

- `docs/WAVE16_NARRATIVE_STATE_ABI.md`
- `docs/WAVE16_INTERACTION_EVENT_ABI.md`
- `docs/WAVE16_TEMPLATE_GENERATOR_ABI.md`
- `docs/NARRATIVE_PORTAL_MODE.md`

### Wave 17: Shared tape and merge rules

- Shared interaction memory and deterministic merge semantics.
- Conflict bundles for deterministic side-by-side world diffing: `wave17.conflict_bundle.v0` (advisory).
- Merge review packets for deterministic conflict presentation: `wave17.merge_review.v0` (advisory).

Docs:

- `docs/WAVE17_SHARED_TAPE_ABI.md`
- `docs/WAVE17_CONFLICT_BUNDLE_ABI.md`
- `docs/WAVE17_MERGE_REVIEW_ABI.md`
- `docs/WAVE17_MERGE_RULES.md`

### Wave 18: Ontology and dialogue grammar

- Role constraints and dialogue grammar are advisory constraints over interaction, not authority.

Docs:

- `docs/WAVE18_AVATAR_ROLE_ABI.md`
- `docs/WAVE18_DIALOGUE_GRAMMAR_ABI.md`

### Wave 19: Entities and world structure

- Entity model: `wave19.entity_model.v0`
- World composition (nodes): `wave19.world_entities.v0`
- World graph (edges): `wave19.world_graph.v0`

Docs:

- `docs/WAVE19_ENTITY_MODEL_ABI.md`
- `docs/WAVE19_WORLD_COMPOSITION_ABI.md`
- `docs/WAVE19_WORLD_GRAPH_ABI.md`

### Wave 20: Behavior grammar

- Behavior grammar defines verbs over structure for traversal/inspection/proposal emission.
- Behavior grammar remains advisory and must not mutate canonical artifacts.

Docs:

- `docs/WAVE20_BEHAVIOR_GRAMMAR_ABI.md`

### Wave 21: Global alignment

- Cross-wave coherence predicate; adds no new structure.
- Validates that references across waves resolve and the structure is coherent.

Docs:

- `docs/WAVE21_ALIGNMENT_ABI.md`

### Wave 22: Reflection algebra

- Finite set of deterministic involutions over world structure.
- Must satisfy `rho(rho(W)) = W`.

Docs:

- `docs/WAVE22_REFLECTION_ABI.md`

### Wave 23: Archetype classification

- Deterministic world typing derived from invariant patterns.
- Must not rank or change merge semantics.

Docs:

- `docs/WAVE23_ARCHETYPE_ABI.md`

### Wave 24: Federation closure

- Deterministic merge algebra for world structure (CRDT-like closure).
- Reject when deterministic merge is not possible under the ABI.

Docs:

- `docs/WAVE24_FEDERATION_ABI.md`

### Wave 25: Provider axis (telemetry)

- Advisory metrics about extension pressure (renderers/adapters/tools).
- No reject based on magnitude, schema and digest validation only.

Docs:

- `docs/WAVE25_PROVIDER_AXIS_ABI.md`

### Wave 26: Consumer axis (telemetry)

- Advisory metrics about interaction pressure.
- Emits warnings for instability (`q_value < 0`), does not reject.

Docs:

- `docs/WAVE26_CONSUMER_AXIS_ABI.md`

### Wave 27: Pointer sync and trace spine (experimental advisory)

- Deterministic pointer sync projection with frozen function IDs and constants.
- Advisory trace-to-Merkle spine mapping for inclusion proofs and partial replay.

Docs:

- `docs/WAVE27_POINTER_SYNC_ABI.md`
- `docs/WAVE27_POINTER_SYNC_FUNCTIONS.md`
- `docs/WAVE27_TRACE_SPINE_ABI.md`

### Wave 28: Advisory algebra engine (experimental advisory)

- Deterministic F2 basis/config/decomposition surfaces for advisory algebraic projection.
- No canonical mutation; projection-only artifacts with strict replay verification.

Docs:

- `docs/WAVE28_ZERO_POLY_BASIS_ABI.md`
- `docs/WAVE28_CLOSED_CONFIG_ABI.md`
- `docs/WAVE28_POLY_DECOMP_ABI.md`

### Wave 29: Advisory action plan bridge (experimental advisory)

- Deterministic bridge that maps verified Wave28 (and optional Wave17/Wave27 evidence) into advisory Wave20 action plans.
- Plans are replay-verifiable and projection-only; they do not execute or mutate canonical state.

Docs:

- `docs/WAVE29_ACTION_PLAN_ABI.md`
- `docs/WAVE29_ACTION_PLAN_FUNCTIONS.md`

### Wave 30: Evidence bundle + physical chord surface (experimental advisory)

- Deterministic advisory packaging of evidence references (`wave30.evidence_bundle.v0`).
- Deterministic advisory LED chord surface derived from bundle digest (`wave30.evidence_surface.chords.v0`).
- Deterministic advisory LED frame stream over 240 ring (`wave30.evidence_surface_frame.v0` NDJSON).
- Spiral visuals are renderer-only and non-canonical.

Docs:

- `docs/WAVE30_EVIDENCE_BUNDLE_ABI.md`
- `docs/WAVE30_EVIDENCE_SURFACE_CHORDS_ABI.md`
- `docs/WAVE30_EVIDENCE_SURFACE_FRAMES_ABI.md`
- `docs/WAVE30_EVIDENCE_SURFACE_EMITTER_FRAMES_ABI.md`
- `docs/WAVE30_EVIDENCE_SURFACE_UART_PACKETS_ABI.md`
- `docs/WAVE30_EVIDENCE_SURFACE_FUNCTIONS.md`

### Wave 31: Hardware decode verifier receipts (experimental advisory)

- Deterministic advisory receipts for hardware decode and frame verification over Wave30 transport surfaces.
- No authority elevation; these artifacts report verification outcomes only.

Docs:

- `docs/WAVE31_HARDWARE_DECODE_RECEIPT_ABI.md`
- `docs/WAVE31_FRAME_VERIFY_RESULT_ABI.md`
- `docs/WAVE31_DEVICE_PARITY_HARNESS.md`

## Compatibility and change control

Protocol semantics are frozen per version line.

- Patch (`vX.Y.Z`): no semantic drift
- Minor (`vX.Y.0`): additive changes, backward compatible
- Major (`vX.0.0`): schema/authority/replay changes, requires migration docs

See:

- `docs/COMPATIBILITY.md`
- `docs/RFC_PROCESS.md`
- `docs/GOVERNANCE.md`

## Implementer checklist

If you are implementing a toolchain or interpreter:

- implement canonical JSON and string membrane exactly
- recompute and verify digests (fail closed)
- treat `advisory` artifacts as non-authoritative
- never accept portal/UI output as canonical state without explicit acceptance flow
