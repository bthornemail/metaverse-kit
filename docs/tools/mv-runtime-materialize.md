# mv-runtime-materialize

Materializes governed Wave31 `world.ir.v0` handoff artifacts into deterministic runtime traces and receipts.

Authority posture:

- Input world IR is projection/handoff data, not canonical law.
- Runtime realization is non-authoritative and must remain deterministic.
- Receipt output is conformance evidence for replay equivalence.

## Command

```bash
node tools/mv-runtime-materialize/index.js materialize-world-ir-wave31 \
  --in /tmp/world31.ir.json \
  --out-trace /tmp/runtime.trace.wave31.ndjson \
  --out-receipt /tmp/runtime.materialization.wave31.receipt.json \
  --out-snapshot /tmp/runtime.snapshot.wave31.json
```

## Contract checks

```bash
npm run -s runtime-materialize:wave31:golden
npm run -s runtime-materialize:wave31:must-reject
npm run -s check:runtime-materialize-wave31-contract
```
