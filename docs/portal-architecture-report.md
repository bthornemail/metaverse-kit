# Demo Portal Architecture Report

## Scope

Boot an immersive demo portal by composing existing spine components without introducing authority.

## Runtime hierarchy placement

- Canonical artifacts (Wave 14/15): **IR layer** (authoritative inputs)
- Demo bundle tools (`mv-pack-demo`, `mv-verify-demo`): **projection tooling layer**
- Portal runtime (`portal/*`): **projection/render layer**
- Proposal bundle tool (`mv-proposal-bundle`): **advisory proposal layer**

No component in this slice is authoritative for canonical state mutation.

## Composition summary

```text
Wave14/15 canonical artifacts
  -> mv-pack-demo
  -> demo.bundle (manifest + integrity + canonical assets)
  -> mv-verify-demo / portal verify.js
  -> portal runtime/render (3-pane replay)
  -> mv-proposal-bundle (export advisory proposal)
```

## Authority boundary checks

- Canonical assets are copied read-only into `demo.bundle/canonical`.
- Portal verifies `integrity.sha256` and all asset digests before render.
- UI interaction exports `wave16.proposal_bundle.v0`; no canonical writes occur.
- Proposal output is explicitly marked `summary.authority = "advisory"`.

## Evaluation status

`bash scripts/demo-portal-eval.sh` validates:

1. deterministic replay test (double pack + verify)
2. integrity failure test (tamper -> fail closed)
3. proposal export test (emit + validate + base digest binding)
4. performance trace output

## Known gaps

See `docs/portal-known-gaps.md`.
