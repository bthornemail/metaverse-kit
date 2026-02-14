# mv-reflect

Wave 22 reflection algebra tool.

## Emit reflection result

```bash
npm run -s mv-reflect -- emit \
  --world-graph dev-docs/wave19/world-graph.v0.json \
  --operator swap_endpoints \
  --out dev-docs/wave22/reflection-result.v0.json \
  --out-world-graph dev-docs/wave22/reflected-world-graph.v0.json
```

## Validate reflection result

```bash
npm run -s mv-reflect -- validate \
  --world-graph dev-docs/wave19/world-graph.v0.json \
  --reflection dev-docs/wave22/reflection-result.v0.json
```
