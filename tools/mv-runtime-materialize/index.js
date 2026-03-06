#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const WORLD_IR_V = 'world.ir.v0';
const RECEIPT_V = 'runtime.materialization.receipt.wave31.v0';

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function usage() {
  console.log(
    'mv-runtime-materialize materialize-world-ir-wave31 --in <world.ir.json> --out-trace <runtime.trace.ndjson> --out-receipt <runtime.materialization.receipt.json> [--out-snapshot <snapshot.json>] [--metabuild <dir>] [--expected-world-ir-digest <sha256:...>]',
  );
}

function parseArgs(argv) {
  const out = { mode: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'materialize-world-ir-wave31') out.mode = 'materialize-world-ir-wave31';
    else if (a === '--in' && argv[i + 1]) out.input = argv[++i];
    else if (a === '--out-trace' && argv[i + 1]) out.outTrace = argv[++i];
    else if (a === '--out-receipt' && argv[i + 1]) out.outReceipt = argv[++i];
    else if (a === '--out-snapshot' && argv[i + 1]) out.outSnapshot = argv[++i];
    else if (a === '--metabuild' && argv[i + 1]) out.metabuild = argv[++i];
    else if (a === '--expected-world-ir-digest' && argv[i + 1]) out.expectedWorldIRDigest = argv[++i];
    else if (a === '--help' || a === '-h') out.mode = 'help';
    else die(`unknown arg: ${a}`);
  }
  return out;
}

function isObj(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

function sha(buf) {
  return `sha256:${crypto.createHash('sha256').update(buf).digest('hex')}`;
}

function assertKeyset(obj, keys, label) {
  const got = Object.keys(obj).sort();
  const want = [...keys].sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    die(`${label} keyset mismatch`);
  }
}

function requireSha(s, label) {
  if (typeof s !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(s)) die(`${label} invalid`);
}

function assertSortedBy(arr, fn, label) {
  let prev = null;
  for (const x of arr) {
    const cur = fn(x);
    if (prev !== null && cur < prev) {
      die(`${label} not sorted`);
    }
    prev = cur;
  }
}

function validateWorldIRWave31(ir) {
  if (!isObj(ir)) die('world.ir must be object');
  assertKeyset(ir, ['world', 'entities', 'zones', 'rules', 'portals', 'attachments', 'events'], 'world.ir');
  if (typeof ir.world !== 'string' || !ir.world) die('world.ir.world must be non-empty string');
  if (!Array.isArray(ir.entities)) die('world.ir.entities must be array');
  if (!Array.isArray(ir.events)) die('world.ir.events must be array');

  assertSortedBy(ir.entities, (e) => e?.id ?? '', 'world.ir.entities');
  for (let i = 0; i < ir.entities.length; i++) {
    const e = ir.entities[i];
    if (!isObj(e)) die(`entity[${i}] must be object`);
    assertKeyset(e, ['id', 'components', 'owner', 'zone'], `entity[${i}]`);
    if (typeof e.id !== 'string' || !e.id) die(`entity[${i}].id invalid`);
    if (!Array.isArray(e.components)) die(`entity[${i}].components must be array`);
    assertSortedBy(e.components, (c) => c?.type ?? '', `entity[${i}].components`);
    const seenTypes = new Set();
    for (let j = 0; j < e.components.length; j++) {
      const c = e.components[j];
      if (!isObj(c)) die(`entity[${i}].components[${j}] must be object`);
      if (typeof c.type !== 'string' || !c.type) die(`entity[${i}].components[${j}].type invalid`);
      if (seenTypes.has(c.type)) die(`entity[${i}] duplicate component type`);
      seenTypes.add(c.type);
      if (c.data !== undefined && !isObj(c.data)) die(`entity[${i}].components[${j}].data invalid`);
    }
  }

  const ids = new Set(ir.entities.map((e) => e.id));
  if (!ids.has('wave31:decode_receipt')) die('world.ir missing wave31:decode_receipt entity');
  if (!ids.has('wave31:frame_verify_result')) die('world.ir missing wave31:frame_verify_result entity');
}

function validateReceipt(receipt) {
  if (!isObj(receipt)) die('receipt must be object');
  assertKeyset(
    receipt,
    [
      'v',
      'authority',
      'world',
      'world_ir_v',
      'world_ir_digest',
      'trace_digest',
      'trace_event_count',
      'materialize_snapshot_digest',
      'replay_snapshot_digest',
      'deterministic',
      'digest',
    ],
    'receipt',
  );
  if (receipt.v !== RECEIPT_V) die('receipt.v mismatch');
  if (receipt.authority !== 'advisory') die('receipt.authority must be advisory');
  if (receipt.world_ir_v !== WORLD_IR_V) die('receipt.world_ir_v mismatch');
  requireSha(receipt.world_ir_digest, 'receipt.world_ir_digest');
  requireSha(receipt.trace_digest, 'receipt.trace_digest');
  requireSha(receipt.materialize_snapshot_digest, 'receipt.materialize_snapshot_digest');
  requireSha(receipt.replay_snapshot_digest, 'receipt.replay_snapshot_digest');
  if (receipt.deterministic !== '0' && receipt.deterministic !== '1') die('receipt.deterministic must be 0|1');
  if (typeof receipt.trace_event_count !== 'string' || !/^\d+$/.test(receipt.trace_event_count)) {
    die('receipt.trace_event_count invalid');
  }
  requireSha(receipt.digest, 'receipt.digest');
  const copy = { ...receipt };
  delete copy.digest;
  const expected = sha(Buffer.from(canonicalJson(copy) + '\n', 'utf8'));
  if (expected !== receipt.digest) die('receipt.digest mismatch');
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

async function writeCanonicalJson(p, obj) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, `${canonicalJson(obj)}\n`, 'utf8');
}

function runPy(script, args) {
  const res = spawnSync('python3', [script, ...args], { encoding: 'utf8' });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || `exit ${res.status}`).trim();
    die(`${path.basename(script)} failed: ${err}`);
  }
  return (res.stdout || '').trim();
}

async function fileSha(p) {
  return sha(await fs.readFile(p));
}

async function traceCount(p) {
  const txt = await fs.readFile(p, 'utf8');
  return String(txt.split('\n').filter((x) => x.trim()).length);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.mode || args.mode === 'help') {
    usage();
    process.exit(0);
  }

  if (args.mode !== 'materialize-world-ir-wave31') {
    die(`unknown mode: ${args.mode}`);
  }

  if (!args.input || !args.outTrace || !args.outReceipt) {
    die('materialize-world-ir-wave31 requires --in --out-trace --out-receipt');
  }

  const mb = args.metabuild || '/home/main/devops/metaverse-build';
  const materialize = path.join(mb, 'runtime/world/materialize.py');
  const replay = path.join(mb, 'runtime/world/replay.py');

  const ir = await readJson(args.input);
  validateWorldIRWave31(ir);

  const worldIRDigest = sha(Buffer.from(canonicalJson(ir) + '\n', 'utf8'));
  if (args.expectedWorldIRDigest) {
    requireSha(args.expectedWorldIRDigest, '--expected-world-ir-digest');
    if (args.expectedWorldIRDigest !== worldIRDigest) die('world.ir digest mismatch');
  }

  const outSnapshot = args.outSnapshot || path.join(path.dirname(args.outTrace), 'runtime.snapshot.wave31.json');
  const replaySnapshot = path.join(path.dirname(args.outTrace), 'runtime.replay.snapshot.wave31.json');

  await fs.mkdir(path.dirname(args.outTrace), { recursive: true });
  await fs.mkdir(path.dirname(args.outReceipt), { recursive: true });
  await fs.mkdir(path.dirname(outSnapshot), { recursive: true });

  const materializeHash = runPy(materialize, [args.input, outSnapshot, args.outTrace]);
  const replayHash = runPy(replay, [args.outTrace, replaySnapshot]);

  if (!/^[0-9a-f]{64}$/.test(materializeHash)) die('materialize hash format invalid');
  if (!/^[0-9a-f]{64}$/.test(replayHash)) die('replay hash format invalid');
  if (materializeHash !== replayHash) die('materialize/replay hash mismatch');

  const receipt = {
    v: RECEIPT_V,
    authority: 'advisory',
    world: ir.world,
    world_ir_v: WORLD_IR_V,
    world_ir_digest: worldIRDigest,
    trace_digest: await fileSha(args.outTrace),
    trace_event_count: await traceCount(args.outTrace),
    materialize_snapshot_digest: await fileSha(outSnapshot),
    replay_snapshot_digest: await fileSha(replaySnapshot),
    deterministic: '1',
  };
  receipt.digest = sha(Buffer.from(canonicalJson(receipt) + '\n', 'utf8'));
  validateReceipt(receipt);
  await writeCanonicalJson(args.outReceipt, receipt);

  console.log(
    `ok mv-runtime-materialize materialize-world-ir-wave31 world=${receipt.world} trace=${receipt.trace_digest} snapshot=${receipt.materialize_snapshot_digest}`,
  );
}

main().catch((err) => die(err?.message || String(err)));
