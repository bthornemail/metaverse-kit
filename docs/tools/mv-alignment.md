# mv-alignment

Build and validate `wave21.alignment_report.v0` artifacts.

## Emit

```bash
npm run -s mv-alignment -- emit \
  --narrative-state dev-docs/narrative/states.v0.json \
  --world-entities dev-docs/wave19/world-entities.v0.json \
  --world-graph dev-docs/wave19/world-graph.v0.json \
  --behavior-grammar dev-docs/wave20/behavior-grammar.v0.json \
  --out dev-docs/wave21/alignment.v0.json
```

## Validate

```bash
npm run -s mv-alignment -- validate \
  --alignment dev-docs/wave21/alignment.v0.json
```
