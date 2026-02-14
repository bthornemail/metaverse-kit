# mv-provider-metric

Wave 25 provider telemetry tool.

## Emit

```bash
npm run -s mv-provider-metric -- emit \
  --seed dev-docs/wave25/provider.seed.json \
  --world-graph dev-docs/wave19/world-graph.v0.json \
  --out dev-docs/wave25/provider-extension.v0.json
```

## Validate

```bash
npm run -s mv-provider-metric -- validate \
  --provider-extension dev-docs/wave25/provider-extension.v0.json \
  --world-graph dev-docs/wave19/world-graph.v0.json
```
