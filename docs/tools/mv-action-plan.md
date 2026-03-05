# mv-action-plan

Deterministic Wave29 advisory action-plan builder and verifier.

## Build

```bash
npm run -s mv-action-plan -- build \
  --projection dev-docs/wave28/signal-poly-projection.v0.json \
  --decomp dev-docs/wave28/poly-decomp.v0.json \
  --merge-review dev-docs/wave17/merge-review.v0.json \
  --residual dev-docs/wave27/pointer-sync.residual.fail.v0.json \
  --out /tmp/wave29.action-plan.json
```

## Verify

```bash
npm run -s mv-action-plan -- verify \
  --in /tmp/wave29.action-plan.json \
  --projection dev-docs/wave28/signal-poly-projection.v0.json \
  --decomp dev-docs/wave28/poly-decomp.v0.json \
  --merge-review dev-docs/wave17/merge-review.v0.json \
  --residual dev-docs/wave27/pointer-sync.residual.fail.v0.json
```
