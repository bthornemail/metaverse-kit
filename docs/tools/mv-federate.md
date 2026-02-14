# mv-federate

Build and validate `wave24.federation_merge_result.v0` artifacts.

## Emit

```bash
npm run -s mv-federate -- emit \
  --left dev-docs/wave24/world-graph.left.v0.json \
  --right dev-docs/wave24/world-graph.right.v0.json \
  --strategy lexicographic \
  --out dev-docs/wave24/federation-merge.v0.json
```

## Validate

```bash
npm run -s mv-federate -- validate \
  --left dev-docs/wave24/world-graph.left.v0.json \
  --right dev-docs/wave24/world-graph.right.v0.json \
  --merge dev-docs/wave24/federation-merge.v0.json
```
