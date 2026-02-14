# mv-world-graph

Build and validate `wave19.world_graph.v0` relation artifacts.

## Emit

```bash
npm run -s mv-world-graph -- emit \
  --seed dev-docs/wave19/world-graph.seed.json \
  --world-entities dev-docs/wave19/world-entities.v0.json \
  --out dev-docs/wave19/world-graph.v0.json
```

## Validate

```bash
npm run -s mv-world-graph -- validate \
  --world-graph dev-docs/wave19/world-graph.v0.json \
  --world-entities dev-docs/wave19/world-entities.v0.json
```
