# mv-runtime-handoff

Builds and verifies the designated runtime handoff artifact (`world.ir.v0`) from canonical Wave projection artifacts.

Authority posture:

- Output is a runtime handoff/projection artifact.
- Canonical meaning remains anchored in `metaverse-kit` law.
- Runtime host (`metaverse-build`) consumes this artifact and must not redefine semantics.

## Commands

```bash
node tools/mv-runtime-handoff/index.js build-world-ir-wave30 \
  --surface dev-docs/wave30/evidence-surface.chords.v0.json \
  --frames dev-docs/wave30/evidence-surface.frames.leds240.v0.ndjson \
  --emitter dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson \
  --uart dev-docs/wave30/evidence-surface.uart.esp32.v0.ndjson \
  --bundle dev-docs/wave30/evidence-bundle.v0.json \
  --out /tmp/world.ir.json \
  --world wave30-surface-v0

node tools/mv-runtime-handoff/index.js build-world-ir-wave31 \
  --receipt dev-docs/wave31/golden/hardware-decode-receipt.v0.json \
  --frame-verify dev-docs/wave31/golden/frame-verify-result.v0.json \
  --out /tmp/world31.ir.json \
  --world wave31-verify-v0

node tools/mv-runtime-handoff/index.js verify-world-ir --in /tmp/world.ir.json
```

## Contract checks

```bash
npm run -s runtime-handoff:wave30:golden
npm run -s runtime-handoff:wave30:must-reject
npm run -s check:runtime-handoff-wave30-contract
npm run -s check:runtime-handoff-wave30-to-world-ir-contract
npm run -s runtime-handoff:wave31:golden
npm run -s runtime-handoff:wave31:must-reject
npm run -s check:runtime-handoff-wave31-contract
```
