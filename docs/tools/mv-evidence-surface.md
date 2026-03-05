# mv-evidence-surface

Deterministic Wave30 advisory evidence-surface builder/verifier/renderer.

## Build

```bash
npm run -s mv-evidence-surface -- build \
  --seed-digest sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --out dev-docs/wave30/evidence-surface.chords.v0.json
```

## Verify

```bash
npm run -s mv-evidence-surface -- verify --in dev-docs/wave30/evidence-surface.chords.v0.json
```

## Render

```bash
npm run -s mv-evidence-surface -- render \
  --in dev-docs/wave30/evidence-surface.chords.v0.json \
  --mode spiral \
  --out /tmp/wave30.spiral.json
```

Modes:

- `chords` (canonical pair list projection)
- `spiral` (renderer-only view)

## Render LEDs240 Frames (NDJSON)

```bash
npm run -s mv-evidence-surface -- render-leds240 \
  --surface dev-docs/wave30/evidence-surface.chords.v0.json \
  --frames 12 \
  --out dev-docs/wave30/evidence-surface.frames.leds240.v0.ndjson
```

Optional pointer schedule:

```bash
--pointer-trace dev-docs/wave27/pointer-sync.trace.commit.ndjson
```

## Verify LEDs240 Frames

```bash
npm run -s mv-evidence-surface -- verify-leds240 \
  --surface dev-docs/wave30/evidence-surface.chords.v0.json \
  --in dev-docs/wave30/evidence-surface.frames.leds240.v0.ndjson
```

## Render LEDs240 ESP32 Emitter Frames

```bash
npm run -s mv-evidence-surface -- render-leds240-esp32 \
  --surface dev-docs/wave30/evidence-surface.chords.v0.json \
  --frames 12 \
  --frame-ms 50 \
  --out dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson
```

Emitter mapping is projection-only:

- `on = sort(unique(pointer_on ∪ chord_on))`
- `dim = sort(chord_dim - on)`
- `pointer = pointer_on`

## Verify LEDs240 ESP32 Emitter Frames

```bash
npm run -s mv-evidence-surface -- verify-leds240-esp32 \
  --surface dev-docs/wave30/evidence-surface.chords.v0.json \
  --frame-ms 50 \
  --in dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson
```

## Emit ESP32 UART Packets (fixed-size)

```bash
npm run -s mv-evidence-surface -- emit-esp32-uart \
  --surface dev-docs/wave30/evidence-surface.chords.v0.json \
  --emitter dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson \
  --uart-crc crc8-xor-v0 \
  --out-bin dev-docs/wave30/evidence-surface.uart.esp32.crc8xor.v0.bin \
  --out dev-docs/wave30/evidence-surface.uart.esp32.crc8xor.v0.ndjson
```

## Verify ESP32 UART Packets

```bash
npm run -s mv-evidence-surface -- verify-esp32-uart \
  --surface dev-docs/wave30/evidence-surface.chords.v0.json \
  --emitter dev-docs/wave30/evidence-surface.frames.leds240.esp32.v0.ndjson \
  --uart-crc crc8-xor-v0 \
  --in-bin dev-docs/wave30/evidence-surface.uart.esp32.crc8xor.v0.bin \
  --in dev-docs/wave30/evidence-surface.uart.esp32.crc8xor.v0.ndjson
```
