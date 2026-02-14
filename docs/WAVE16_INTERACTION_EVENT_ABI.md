# WAVE16 Interaction Tape ABI

Status: frozen for Wave 16.1 (Solon generator path).

## Model

`wave16.interaction_tape.v0`

Projection-only interaction artifact. Advisory. Non-authoritative.

## Top-level keyset (exact)

- `v`
- `authority`
- `base_bundle_digest`
- `narrative_state_digest`
- `events`
- `digest`

Rules:

- `v` MUST be `wave16.interaction_tape.v0`
- `authority` MUST be `advisory`
- digests MUST match `sha256:<64hex>`
- `digest` is sha256 of canonical JSON of the model without `digest`

## Event keyset (exact)

- `t`
- `verb`
- `target`
- `params`
- `prev`
- `digest`

Rules:

- `t` is decimal-string index; contiguous from `"0"`
- `prev` is previous event digest; event 0 uses `"genesis"`
- `digest` is sha256 of canonical JSON of event without `digest`

## Allowed verbs (v0)

- `OPEN_PASSAGE`
- `SET_STANCE`
- `SELECT_GENERATOR`
- `GENERATE_PROPOSAL`
- `FOCUS_NODE`
- `MOVE_ENTITY_PROPOSAL`

Unknown verbs MUST reject.

## Target constraints (v0)

- `OPEN_PASSAGE.target` MUST resolve to `narrative_state.states[].id`
- `SET_STANCE.target` MUST be one of:
  - `solon`
  - `solomon`
  - `asabiyyah`
  - `metatron`
- `SELECT_GENERATOR.target` and `GENERATE_PROPOSAL.target` MUST equal:
  - `wave16.gen.solon.constitution.v0`
- `FOCUS_NODE.target` and `MOVE_ENTITY_PROPOSAL.target` MUST be `sha256:<64hex>` node identifiers
