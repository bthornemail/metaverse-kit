# mv-archetype

Wave 23 deterministic archetype classifier.

## Emit

```bash
npm run -s mv-archetype -- emit \
  --world-graph dev-docs/wave19/world-graph.v0.json \
  --out dev-docs/wave23/archetype-signature.v0.json
```

## Validate

```bash
npm run -s mv-archetype -- validate \
  --world-graph dev-docs/wave19/world-graph.v0.json \
  --archetype dev-docs/wave23/archetype-signature.v0.json
```
