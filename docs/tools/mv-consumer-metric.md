# mv-consumer-metric

Wave 26 consumer telemetry tool.

## Emit

```bash
npm run -s mv-consumer-metric -- emit \
  --seed dev-docs/wave26/consumer.seed.json \
  --provider-extension dev-docs/wave25/provider-extension.v0.json \
  --world-graph dev-docs/wave19/world-graph.v0.json \
  --out dev-docs/wave26/consumer-trace.v0.json
```

## Validate

```bash
npm run -s mv-consumer-metric -- validate \
  --consumer-trace dev-docs/wave26/consumer-trace.v0.json \
  --provider-extension dev-docs/wave25/provider-extension.v0.json \
  --world-graph dev-docs/wave19/world-graph.v0.json
```
