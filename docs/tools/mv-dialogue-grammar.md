# mv-dialogue-grammar

Build and validate `wave18.dialogue_grammar.v0` artifacts.

## Emit

```bash
npm run -s mv-dialogue-grammar -- emit \
  --seed dev-docs/wave18/dialogue-grammar.seed.json \
  --out dev-docs/wave18/dialogue-grammar.v0.json
```

## Validate

```bash
npm run -s mv-dialogue-grammar -- validate \
  --grammar dev-docs/wave18/dialogue-grammar.v0.json
```
