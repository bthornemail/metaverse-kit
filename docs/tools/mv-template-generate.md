# `mv-template-generate`

Wave 16.1 template generator (Solon constitution path).

Consumes:

- `wave16.narrative_state.v0`
- `wave16.interaction_tape.v0`
- base bundle digest

Emits:

- `wave16.proposal_bundle.v0` (advisory)

## Usage

```bash
npm run -s mv-template-generate -- \
  --base-bundle-digest sha256:090c6c2a8a2ef694bfe1b8824caa542026499627fac4dd93d2149a865d4eb84a \
  --narrative-state dev-docs/narrative/states.v0.json \
  --interaction-tape dev-docs/narrative/solon-path.tape.v0.json \
  --out dev-docs/narrative/solon-constitution.proposal.v0.json
```

Rejects if required Solon path interactions are missing.
