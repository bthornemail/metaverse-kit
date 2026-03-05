# mv-pointer-sync

Deterministic Wave27 pointer-sync simulator and verifier (advisory-only).

## Emit Ring Basis

```bash
npm run -s mv-pointer-sync -- emit-ring-basis --out dev-docs/wave27/ring-basis.v0.json
```

## Simulate

```bash
npm run -s mv-pointer-sync -- simulate \
  --ring-basis dev-docs/wave27/ring-basis.v0.json \
  --steps 12 \
  --a-c7 0 --a-outer 010101 \
  --b-c7 0 --b-outer 010101 \
  --out /tmp/pointer-sync.trace.ndjson
```

## Verify

```bash
npm run -s mv-pointer-sync -- verify \
  --in /tmp/pointer-sync.trace.ndjson \
  --ring-basis dev-docs/wave27/ring-basis.v0.json \
  --a-c7 0 --a-outer 010101 \
  --b-c7 0 --b-outer 010101
```
