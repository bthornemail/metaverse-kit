# mv-entity-model

Build and validate `wave19.entity_model.v0` artifacts.

## Emit

```bash
npm run -s mv-entity-model -- emit \
  --seed dev-docs/wave19/entity.seed.json \
  --out dev-docs/wave19/entity.v0.json
```

## Validate

```bash
npm run -s mv-entity-model -- validate \
  --entity dev-docs/wave19/entity.v0.json
```
