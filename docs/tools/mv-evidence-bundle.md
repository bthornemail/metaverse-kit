# mv-evidence-bundle

Deterministic Wave30 advisory evidence bundle builder and verifier.

## Build

```bash
npm run -s mv-evidence-bundle -- build \
  --subject-digest sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --claim-type merge_review \
  --evidence dev-docs/wave27/pointer-sync.residual.fail.v0.json \
  --evidence dev-docs/wave28/signal-poly-projection.v0.json \
  --evidence dev-docs/wave28/poly-decomp.v0.json \
  --evidence dev-docs/wave29/action-plan.with-evidence.v0.json \
  --out dev-docs/wave30/evidence-bundle.v0.json
```

## Verify

```bash
npm run -s mv-evidence-bundle -- verify --in dev-docs/wave30/evidence-bundle.v0.json
```
