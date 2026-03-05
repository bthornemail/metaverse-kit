# mv-conflict-bundle

Build and validate `wave17.conflict_bundle.v0` artifacts.

## Emit

```bash
npm run -s mv-conflict-bundle -- emit \
  --left-world dev-docs/wave17/conflict-world.left.v0.json \
  --right-world dev-docs/wave17/conflict-world.right.v0.json \
  --out dev-docs/wave17/conflict-bundle.v0.json \
  --out-trace /tmp/conflict-trace.ndjson
```

Optional:

- `--strategy manual_review|prefer_left|prefer_right`

## Validate

```bash
npm run -s mv-conflict-bundle -- validate \
  --conflict-bundle dev-docs/wave17/conflict-bundle.v0.json
```
