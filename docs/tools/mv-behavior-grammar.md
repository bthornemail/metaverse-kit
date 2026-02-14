# mv-behavior-grammar

Build and validate `wave20.behavior_grammar.v0` artifacts.

## Emit

```bash
npm run -s mv-behavior-grammar -- emit \
  --seed dev-docs/wave20/behavior-grammar.seed.json \
  --world-graph dev-docs/wave19/world-graph.v0.json \
  --out dev-docs/wave20/behavior-grammar.v0.json
```

## Validate

```bash
npm run -s mv-behavior-grammar -- validate \
  --behavior-grammar dev-docs/wave20/behavior-grammar.v0.json \
  --world-graph dev-docs/wave19/world-graph.v0.json
```
