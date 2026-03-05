# mv-poly-decompose

Deterministic Wave28 decomposition runner and validator.

## Run

```bash
npm run -s mv-poly-decompose -- run \
  --basis dev-docs/wave28/zero-poly-basis.v0.json \
  --closed dev-docs/wave28/closed-config.v0.json \
  --poly 'x1+x3*x5' \
  --out dev-docs/wave28/poly-decomp.v0.json
```

## Validate

```bash
npm run -s mv-poly-decompose -- validate \
  --in dev-docs/wave28/poly-decomp.v0.json \
  --basis dev-docs/wave28/zero-poly-basis.v0.json \
  --closed dev-docs/wave28/closed-config.v0.json
```
