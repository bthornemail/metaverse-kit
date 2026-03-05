# mv-merge-review

Build and validate `wave17.merge_review.v0` artifacts.

## Emit

```bash
npm run -s mv-merge-review -- emit \
  --conflict-bundle dev-docs/wave17/conflict-bundle.v0.json \
  --out dev-docs/wave17/merge-review.v0.json
```

## Validate

```bash
npm run -s mv-merge-review -- validate \
  --merge-review dev-docs/wave17/merge-review.v0.json
```
