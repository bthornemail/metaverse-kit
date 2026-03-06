#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const SURFACE_V = 'wave30.evidence_surface.chords.v0';
const FRAME_V = 'wave30.evidence_surface_frame.v0';
const W31_RECEIPT_V = 'wave31.hardware_decode_receipt.v0';
const W31_VERIFY_V = 'wave31.frame_verify_result.v0';
const W31_DECODE_PROFILE_ID = 'wave31.decode_profile.esp32_uart.v0';
const W31_FRAME_VERIFY_ID = 'wave31.frame_verify.leds240.v0';
const WORLD_IR_V = 'world.ir.v0';

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function usage() {
  console.log('mv-runtime-handoff build-world-ir --surface <surface.json> --frames <frames.ndjson> --out <world.ir.json> [--world <id>]');
  console.log('mv-runtime-handoff build-world-ir-wave31 --receipt <receipt.json> --frame-verify <verify.json> --out <world.ir.json> [--world <id>]');
  console.log('mv-runtime-handoff verify-world-ir --in <world.ir.json>');
}

function parseArgs(argv) {
  const out = { mode: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'build-world-ir') out.mode = 'build-world-ir';
    else if (a === 'build-world-ir-wave31') out.mode = 'build-world-ir-wave31';
    else if (a === 'verify-world-ir') out.mode = 'verify-world-ir';
    else if (a === '--surface' && argv[i + 1]) out.surface = argv[++i];
    else if (a === '--frames' && argv[i + 1]) out.frames = argv[++i];
    else if (a === '--receipt' && argv[i + 1]) out.receipt = argv[++i];
    else if (a === '--frame-verify' && argv[i + 1]) out.frameVerify = argv[++i];
    else if (a === '--out' && argv[i + 1]) out.out = argv[++i];
    else if (a === '--in' && argv[i + 1]) out.input = argv[++i];
    else if (a === '--world' && argv[i + 1]) out.world = argv[++i];
    else if (a === '--help' || a === '-h') out.mode = 'help';
    else die(`unknown arg: ${a}`);
  }
  return out;
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

function sha(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function isObj(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

function assertKeyset(obj, keys, label) {
  const got = Object.keys(obj).sort();
  const want = [...keys].sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    die(`${label} keyset mismatch`);
  }
}

function toIntString(s, min, max, label) {
  if (typeof s !== 'string' || !/^\d+$/.test(s)) die(`${label} must be decimal string`);
  const n = Number(s);
  if (!Number.isInteger(n) || n < min || n > max) die(`${label} out of range`);
  return n;
}

function validateBitString(s, label) {
  if (s !== '0' && s !== '1') die(`${label} must be 0 or 1`);
}

function validateIdxArray(arr, label) {
  if (!Array.isArray(arr)) die(`${label} must be array`);
  let prev = -1;
  const seen = new Set();
  for (const x of arr) {
    const n = toIntString(x, 0, 239, `${label}[]`);
    if (seen.has(x)) die(`${label} duplicate index`);
    if (n < prev) die(`${label} not sorted`);
    seen.add(x);
    prev = n;
  }
}

function requireSha(ref, label) {
  if (typeof ref !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(ref)) die(`${label} invalid`);
}

function validateArtifactDigest(obj, label) {
  requireSha(obj.digest, `${label} digest`);
  const payload = { ...obj };
  delete payload.digest;
  const expected = sha(Buffer.from(canonicalJson(payload) + '\n', 'utf8'));
  if (obj.digest !== expected) die(`${label} digest mismatch`);
}

function validateSurface(surface) {
  if (!isObj(surface)) die('surface must be object');
  assertKeyset(surface, ['v', 'authority', 'seed_digest', 'ring_size', 'p0', 'd', 'k_max', 'chords_digest', 'digest'], 'surface');
  if (surface.v !== SURFACE_V) die('surface version mismatch');
  if (surface.authority !== 'advisory') die('surface authority must be advisory');
  if (surface.ring_size !== '240') die('surface ring_size mismatch');
  requireSha(surface.seed_digest, 'surface.seed_digest');
  requireSha(surface.chords_digest, 'surface.chords_digest');
  validateArtifactDigest(surface, 'surface');
}

function validateFrame(frame, i, expectedSurfaceDigest) {
  if (!isObj(frame)) die(`frame[${i}] must be object`);
  assertKeyset(frame, ['v', 'authority', 't', 'ring_size', 'mode', 'pointer_on', 'chord_on', 'chord_dim', 'surface_digest', 'digest'], `frame[${i}]`);
  if (frame.v !== FRAME_V) die(`frame[${i}] version mismatch`);
  if (frame.authority !== 'advisory') die(`frame[${i}] authority must be advisory`);
  if (frame.ring_size !== '240') die(`frame[${i}] ring_size mismatch`);
  if (frame.mode !== 'leds240') die(`frame[${i}] mode mismatch`);
  requireSha(frame.surface_digest, `frame[${i}].surface_digest`);
  validateArtifactDigest(frame, `frame[${i}]`);
  if (frame.surface_digest !== expectedSurfaceDigest) die(`frame[${i}] surface_digest mismatch`);
  const t = toIntString(frame.t, 0, 1_000_000_000, `frame[${i}].t`);
  if (t !== i) die(`frame[${i}] t sequence mismatch`);
  validateIdxArray(frame.pointer_on, `frame[${i}].pointer_on`);
  validateIdxArray(frame.chord_on, `frame[${i}].chord_on`);
  validateIdxArray(frame.chord_dim, `frame[${i}].chord_dim`);
  const on = new Set(frame.chord_on);
  for (const x of frame.chord_dim) {
    if (on.has(x)) die(`frame[${i}] chord_on intersects chord_dim`);
  }
}

function validateWave31Receipt(x) {
  if (!isObj(x)) die('wave31 receipt must be object');
  assertKeyset(x, [
    'v', 'authority', 'decode_profile_id', 'surface_digest', 'packet_stream_digest',
    'uart_crc', 'packet_count', 'decode_ok', 'error_count', 'first_error_code', 'digest',
  ], 'wave31 receipt');

  if (x.v !== W31_RECEIPT_V) die('wave31 receipt version mismatch');
  if (x.authority !== 'advisory') die('wave31 receipt authority must be advisory');
  if (x.decode_profile_id !== W31_DECODE_PROFILE_ID) die('wave31 receipt decode_profile_id mismatch');
  requireSha(x.surface_digest, 'wave31 receipt surface_digest');
  requireSha(x.packet_stream_digest, 'wave31 receipt packet_stream_digest');
  validateArtifactDigest(x, 'wave31 receipt');
  if (x.uart_crc !== 'none' && x.uart_crc !== 'crc8-xor-v0') die('wave31 receipt uart_crc unknown');
  toIntString(x.packet_count, 0, 1_000_000_000, 'wave31 receipt packet_count');
  validateBitString(x.decode_ok, 'wave31 receipt decode_ok');
  const errCount = toIntString(x.error_count, 0, 1_000_000_000, 'wave31 receipt error_count');
  if (x.decode_ok === '1') {
    if (errCount !== 0) die('wave31 receipt decode_ok=1 requires error_count=0');
    if (x.first_error_code !== 'none') die('wave31 receipt decode_ok=1 requires first_error_code=none');
  }
}

function validateWave31Verify(x) {
  if (!isObj(x)) die('wave31 frame verify must be object');
  assertKeyset(x, [
    'v', 'authority', 'frame_verify_id', 'frame_type', 'surface_digest',
    'frame_stream_digest', 'frame_count', 'verify_ok', 'mismatch_count', 'first_mismatch_t', 'digest',
  ], 'wave31 frame verify');

  if (x.v !== W31_VERIFY_V) die('wave31 frame verify version mismatch');
  if (x.authority !== 'advisory') die('wave31 frame verify authority must be advisory');
  if (x.frame_verify_id !== W31_FRAME_VERIFY_ID) die('wave31 frame verify frame_verify_id mismatch');
  if (x.frame_type !== 'wave30.evidence_surface_emitter_frame.esp32.v0') die('wave31 frame verify frame_type mismatch');
  requireSha(x.surface_digest, 'wave31 frame verify surface_digest');
  requireSha(x.frame_stream_digest, 'wave31 frame verify frame_stream_digest');
  validateArtifactDigest(x, 'wave31 frame verify');
  toIntString(x.frame_count, 0, 1_000_000_000, 'wave31 frame verify frame_count');
  validateBitString(x.verify_ok, 'wave31 frame verify verify_ok');
  const mismatchCount = toIntString(x.mismatch_count, 0, 1_000_000_000, 'wave31 frame verify mismatch_count');
  if (x.verify_ok === '1') {
    if (mismatchCount !== 0) die('wave31 frame verify verify_ok=1 requires mismatch_count=0');
    if (x.first_mismatch_t !== 'none') die('wave31 frame verify verify_ok=1 requires first_mismatch_t=none');
  } else {
    toIntString(x.first_mismatch_t, 0, 1_000_000_000, 'wave31 frame verify first_mismatch_t');
  }
}

function validateWorldIR(ir) {
  if (!isObj(ir)) die('world.ir must be object');
  assertKeyset(ir, ['world', 'entities', 'zones', 'rules', 'portals', 'attachments', 'events'], 'world.ir');
  if (typeof ir.world !== 'string' || !ir.world) die('world.ir.world must be non-empty string');

  if (!Array.isArray(ir.entities)) die('world.ir.entities must be array');
  for (let i = 0; i < ir.entities.length; i++) {
    const e = ir.entities[i];
    if (!isObj(e)) die(`entity[${i}] must be object`);
    assertKeyset(e, ['id', 'components', 'owner', 'zone'], `entity[${i}]`);
    if (typeof e.id !== 'string' || !e.id) die(`entity[${i}].id invalid`);
    if (!Array.isArray(e.components)) die(`entity[${i}].components must be array`);
    if (typeof e.owner !== 'string' || !e.owner) die(`entity[${i}].owner invalid`);
    if (typeof e.zone !== 'string' || !e.zone) die(`entity[${i}].zone invalid`);
    for (let j = 0; j < e.components.length; j++) {
      const c = e.components[j];
      if (!isObj(c)) die(`entity[${i}].components[${j}] must be object`);
      if (typeof c.type !== 'string' || !c.type) die(`entity[${i}].components[${j}].type invalid`);
      if (c.data !== undefined && !isObj(c.data)) die(`entity[${i}].components[${j}].data invalid`);
    }
  }

  for (const arrName of ['zones', 'rules', 'portals', 'attachments', 'events']) {
    if (!Array.isArray(ir[arrName])) die(`world.ir.${arrName} must be array`);
  }

  for (let i = 0; i < ir.zones.length; i++) {
    const z = ir.zones[i];
    if (!isObj(z) || typeof z.id !== 'string' || !z.id) die(`zone[${i}] invalid`);
  }

  for (let i = 0; i < ir.events.length; i++) {
    const ev = ir.events[i];
    if (!isObj(ev)) die(`event[${i}] must be object`);
    if (typeof ev.id !== 'string' || !ev.id) die(`event[${i}].id invalid`);
    if (!isObj(ev.intent)) die(`event[${i}].intent invalid`);
    if (ev.authority !== undefined && typeof ev.authority !== 'string') die(`event[${i}].authority invalid`);
  }
}

function buildWorldIR(surface, frames, world) {
  const stats = new Map();
  const ensure = (idx) => {
    if (!stats.has(idx)) stats.set(idx, { on: 0, dim: 0, pointer: 0 });
    return stats.get(idx);
  };

  for (const fr of frames) {
    for (const idx of fr.chord_on) ensure(idx).on += 1;
    for (const idx of fr.chord_dim) ensure(idx).dim += 1;
    for (const idx of fr.pointer_on) ensure(idx).pointer += 1;
  }

  const indices = [...stats.keys()].sort((a, b) => Number(a) - Number(b));

  const entities = indices.map((idx) => {
    const st = stats.get(idx);
    return {
      id: `led:${idx}`,
      owner: 'projection:wave30',
      zone: 'ring:240',
      components: [
        { type: 'wave30.led.index', data: { index: idx } },
        {
          type: 'wave30.led.activity',
          data: {
            on_hits: String(st.on),
            dim_hits: String(st.dim),
            pointer_hits: String(st.pointer),
            surface_digest: surface.digest,
          },
        },
      ],
    };
  });

  const events = frames.map((fr) => ({
    id: `frame:${fr.t}`,
    authority: 'advisory',
    intent: {
      type: 'wave30.frame.leds240',
      t: fr.t,
      pointer_on: fr.pointer_on,
      chord_on: fr.chord_on,
      chord_dim: fr.chord_dim,
      surface_digest: fr.surface_digest,
    },
  }));

  return {
    world,
    entities,
    zones: [{ id: 'ring:240', tags: ['wave30', 'leds240', 'projection'] }],
    rules: [],
    portals: [{ id: 'portal:wave30', entry: { source: 'wave30', mode: 'projection_bundle', version: WORLD_IR_V } }],
    attachments: [],
    events,
  };
}

function buildWorldIRWave31(receipt, verify, world) {
  const entities = [
    {
      id: 'wave31:decode_receipt',
      owner: 'projection:wave31',
      zone: 'verification:wave31',
      components: [
        {
          type: 'wave31.decode.receipt',
          data: {
            decode_profile_id: receipt.decode_profile_id,
            surface_digest: receipt.surface_digest,
            packet_stream_digest: receipt.packet_stream_digest,
            uart_crc: receipt.uart_crc,
            packet_count: receipt.packet_count,
            decode_ok: receipt.decode_ok,
            error_count: receipt.error_count,
            first_error_code: receipt.first_error_code,
            digest: receipt.digest,
          },
        },
      ],
    },
    {
      id: 'wave31:frame_verify_result',
      owner: 'projection:wave31',
      zone: 'verification:wave31',
      components: [
        {
          type: 'wave31.frame.verify',
          data: {
            frame_verify_id: verify.frame_verify_id,
            frame_type: verify.frame_type,
            surface_digest: verify.surface_digest,
            frame_stream_digest: verify.frame_stream_digest,
            frame_count: verify.frame_count,
            verify_ok: verify.verify_ok,
            mismatch_count: verify.mismatch_count,
            first_mismatch_t: verify.first_mismatch_t,
            digest: verify.digest,
          },
        },
      ],
    },
  ];

  const events = [
    {
      id: 'event:wave31:decode_receipt',
      authority: 'advisory',
      intent: {
        type: W31_RECEIPT_V,
        digest: receipt.digest,
        decode_ok: receipt.decode_ok,
        packet_count: receipt.packet_count,
      },
    },
    {
      id: 'event:wave31:frame_verify_result',
      authority: 'advisory',
      intent: {
        type: W31_VERIFY_V,
        digest: verify.digest,
        verify_ok: verify.verify_ok,
        frame_count: verify.frame_count,
      },
    },
  ];

  return {
    world,
    entities,
    zones: [{ id: 'verification:wave31', tags: ['wave31', 'verification', 'projection'] }],
    rules: [],
    portals: [{ id: 'portal:wave31', entry: { source: 'wave31', mode: 'projection_bundle', version: WORLD_IR_V } }],
    attachments: [],
    events,
  };
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

async function readNdjson(p) {
  const txt = await fs.readFile(p, 'utf8');
  const rows = txt.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => JSON.parse(x));
  if (rows.length === 0) die('frames NDJSON empty');
  return rows;
}

async function writeJson(p, obj) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, `${canonicalJson(obj)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.mode || args.mode === 'help') {
    usage();
    process.exit(0);
  }

  if (args.mode === 'build-world-ir') {
    if (!args.surface || !args.frames || !args.out) die('build-world-ir requires --surface --frames --out');
    const world = args.world || 'wave30-surface-v0';
    const surface = await readJson(args.surface);
    validateSurface(surface);
    const frames = await readNdjson(args.frames);
    for (let i = 0; i < frames.length; i++) validateFrame(frames[i], i, surface.digest);
    const worldIr = buildWorldIR(surface, frames, world);
    validateWorldIR(worldIr);
    await writeJson(args.out, worldIr);
    const digest = sha(Buffer.from(canonicalJson(worldIr) + '\n', 'utf8'));
    console.log(`ok mv-runtime-handoff build-world-ir world=${world} digest=${digest}`);
    return;
  }

  if (args.mode === 'build-world-ir-wave31') {
    if (!args.receipt || !args.frameVerify || !args.out) die('build-world-ir-wave31 requires --receipt --frame-verify --out');
    const receipt = await readJson(args.receipt);
    const verify = await readJson(args.frameVerify);
    validateWave31Receipt(receipt);
    validateWave31Verify(verify);
    if (receipt.surface_digest !== verify.surface_digest) die('wave31 receipt/verify surface_digest mismatch');
    const world = args.world || 'wave31-verify-v0';
    const worldIr = buildWorldIRWave31(receipt, verify, world);
    validateWorldIR(worldIr);
    await writeJson(args.out, worldIr);
    const digest = sha(Buffer.from(canonicalJson(worldIr) + '\n', 'utf8'));
    console.log(`ok mv-runtime-handoff build-world-ir-wave31 world=${world} digest=${digest}`);
    return;
  }

  if (args.mode === 'verify-world-ir') {
    if (!args.input) die('verify-world-ir requires --in');
    const ir = await readJson(args.input);
    validateWorldIR(ir);
    const digest = sha(Buffer.from(canonicalJson(ir) + '\n', 'utf8'));
    console.log(`ok mv-runtime-handoff verify-world-ir world=${ir.world} digest=${digest}`);
    return;
  }

  die(`unknown mode: ${args.mode}`);
}

main().catch((err) => die(err?.message || String(err)));
