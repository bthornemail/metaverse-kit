# mv-poly-closed-config

Deterministic Wave28 closed-config builder and validator.

## Build

```bash
npm run -s mv-poly-closed-config -- build \
  --basis dev-docs/wave28/zero-poly-basis.v0.json \
  --constraints dev-docs/wave28/constraints.v0.json \
  --carrier dev-docs/wave28/carrier-state.v0.json \
  --out dev-docs/wave28/closed-config.v0.json
```

## Validate

```bash
npm run -s mv-poly-closed-config -- validate \
  --in dev-docs/wave28/closed-config.v0.json \
  --basis dev-docs/wave28/zero-poly-basis.v0.json
```
