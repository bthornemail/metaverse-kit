# mv-shared-tape

Build and validate `wave17.shared_tape.v0` artifacts.

## Emit

```bash
npm run -s mv-shared-tape -- emit \
  --base-bundle-digest sha256:... \
  --seed dev-docs/wave17/shared-tape.seed.json \
  --out dev-docs/wave17/shared-tape.v0.json
```

## Validate

```bash
npm run -s mv-shared-tape -- validate \
  --shared-tape dev-docs/wave17/shared-tape.v0.json
```
