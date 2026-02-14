# WAVE16 Template Generator ABI

Status: frozen for Wave 16.1 (single Solon generator).

## Generator model

`wave16.template_generator.v0` (descriptor)

## Descriptor keyset (exact)

- `v`
- `authority`
- `generator_id`
- `label`
- `input_requirements`
- `emits`
- `digest`

Rules:

- `authority` MUST be `advisory`
- `generator_id` fixed in 16.1:
  - `wave16.gen.solon.constitution.v0`
- `emits` fixed in 16.1:
  - `wave16.proposal_bundle.v0`

## Required input bindings

- `base_bundle_digest`
- `narrative_state_digest`
- `interaction_tape_digest`

All three are required and MUST match the consumed artifacts.

## Proposal model emitted

`wave16.proposal_bundle.v0`

Top-level keyset (exact):

- `v`
- `authority`
- `base_bundle_digest`
- `narrative_state_digest`
- `interaction_tape_digest`
- `generator_id`
- `payload`
- `digest`

Rules:

- `authority` MUST be `advisory`
- `generator_id` MUST be `wave16.gen.solon.constitution.v0`
- `digest` is sha256 of canonical JSON of proposal without `digest`

## Solon path preconditions (16.1)

The interaction tape MUST contain:

1. `OPEN_PASSAGE` for PRELUDE/02 state id (`PRELUDE/On the Turning Away from the Word .md`)
2. `OPEN_PASSAGE` for `ARTICLE II.md` state id
3. `SET_STANCE` target `solon`
4. `SELECT_GENERATOR` target `wave16.gen.solon.constitution.v0`
5. `GENERATE_PROPOSAL` target `wave16.gen.solon.constitution.v0`

If any precondition is missing, generation MUST reject.
