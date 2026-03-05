# mv-poly-signal-project

Advisory projection adapter that maps pointer-sync or TX/RX NDJSON streams to a canonical Wave28 input polynomial.

## Project

```bash
npm run -s mv-poly-signal-project -- project \
  --pointer-trace dev-docs/wave27/pointer-sync.trace.commit.ndjson \
  --out /tmp/wave28.signal-poly.json \
  --out-log /tmp/wave28.signal-poly.ndjson
```

## Validate

```bash
npm run -s mv-poly-signal-project -- validate --in /tmp/wave28.signal-poly.json
```
