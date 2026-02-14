# mv-world-merge

Build and validate `wave21.world_merge.v0` artifacts.

## Emit

```bash
npm run -s mv-world-merge -- emit \
  --left dev-docs/wave21/world-graph.left.v0.json \
  --right dev-docs/wave21/world-graph.right.v0.json \
  --strategy lexicographic \
  --out dev-docs/wave21/world-merge.v0.json
```

## Validate

```bash
npm run -s mv-world-merge -- validate \
  --left dev-docs/wave21/world-graph.left.v0.json \
  --right dev-docs/wave21/world-graph.right.v0.json \
  --merge dev-docs/wave21/world-merge.v0.json
```
