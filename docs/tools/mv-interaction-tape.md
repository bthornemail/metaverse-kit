# `mv-interaction-tape`

Deterministic interaction tape emitter/validator for Narrative Mode.

## Emit

```bash
npm run -s mv-interaction-tape -- emit \
  --base-bundle-digest sha256:090c6c2a8a2ef694bfe1b8824caa542026499627fac4dd93d2149a865d4eb84a \
  --narrative-state dev-docs/narrative/states.v0.json \
  --steps dev-docs/narrative/solon-path.steps.json \
  --out dev-docs/narrative/solon-path.tape.v0.json
```

## Validate

```bash
npm run -s mv-interaction-tape -- validate \
  --narrative-state dev-docs/narrative/states.v0.json \
  --tape dev-docs/narrative/solon-path.tape.v0.json
```

Fails closed on unknown verbs, unresolved targets, broken chain, non-contiguous `t`, and digest mismatches.
