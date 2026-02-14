# mv-world-compose

Build and validate `wave19.world_entities.v0` composition artifacts.

## Emit

```bash
npm run -s mv-world-compose -- emit \
  --seed dev-docs/wave19/world-compose.seed.json \
  --entity dev-docs/wave19/entity.v0.json \
  --out dev-docs/wave19/world-entities.v0.json
```

## Validate

```bash
npm run -s mv-world-compose -- validate \
  --world dev-docs/wave19/world-entities.v0.json \
  --entity dev-docs/wave19/entity.v0.json
```
