#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { canonicalJson, die, keyset, requireSha, requireStringMembrane, shaPref } from "../wave28-poly-lib.js";

const SURFACE_V = "wave30.evidence_surface.chords.v0";
const FRAME_V = "wave30.evidence_surface_frame.v0";
const EMITTER_FRAME_V = "wave30.evidence_surface_emitter_frame.esp32.v0";
const UART_PACKET_V = "wave30.evidence_surface_uart_packet.esp32.v0";
const RING_SIZE = 240;
const K_MAX_LIMIT = 48;
const UART_PACKET_BYTES = 67;
const UART_CRC_ID = "crc8-xor-v0";

function parseArgs(argv) {
  const out = { mode: "", modeRender: "chords", frames: "12", frameMs: "50", uartCrc: "none" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "build") out.mode = "build";
    else if (a === "verify") out.mode = "verify";
    else if (a === "render") out.mode = "render";
    else if (a === "render-leds240") out.mode = "render-leds240";
    else if (a === "verify-leds240") out.mode = "verify-leds240";
    else if (a === "render-leds240-esp32") out.mode = "render-leds240-esp32";
    else if (a === "verify-leds240-esp32") out.mode = "verify-leds240-esp32";
    else if (a === "emit-esp32-uart") out.mode = "emit-esp32-uart";
    else if (a === "verify-esp32-uart") out.mode = "verify-esp32-uart";
    else if (a === "--seed-digest" && argv[i + 1]) out.seedDigest = argv[++i];
    else if (a === "--in" && argv[i + 1]) out.input = argv[++i];
    else if (a === "--surface" && argv[i + 1]) out.surface = argv[++i];
    else if (a === "--pointer-trace" && argv[i + 1]) out.pointerTrace = argv[++i];
    else if (a === "--emitter" && argv[i + 1]) out.emitter = argv[++i];
    else if (a === "--frames" && argv[i + 1]) out.frames = argv[++i];
    else if (a === "--frame-ms" && argv[i + 1]) out.frameMs = argv[++i];
    else if (a === "--uart-crc" && argv[i + 1]) out.uartCrc = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--out-bin" && argv[i + 1]) out.outBin = argv[++i];
    else if (a === "--in-bin" && argv[i + 1]) out.inputBin = argv[++i];
    else if (a === "--mode" && argv[i + 1]) out.modeRender = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else die(`unknown arg: ${a}`);
  }
  return out;
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(path.resolve(process.cwd(), p), "utf8"));
}

async function writeJson(p, obj) {
  await fs.writeFile(path.resolve(process.cwd(), p), canonicalJson(obj), "utf8");
}

async function readNdjson(p) {
  const raw = await fs.readFile(path.resolve(process.cwd(), p), "utf8");
  if (!raw.endsWith("\n")) die("NDJSON must end with newline");
  const lines = raw.trimEnd().split("\n");
  return lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch {
      die(`invalid NDJSON line ${i + 1}`);
    }
  });
}

async function writeNdjson(p, rows) {
  const text = rows.map((r) => canonicalJson(r)).join("");
  await fs.writeFile(path.resolve(process.cwd(), p), text, "utf8");
}

async function writeBin(p, buf) {
  await fs.writeFile(path.resolve(process.cwd(), p), buf);
}

async function readBin(p) {
  return fs.readFile(path.resolve(process.cwd(), p));
}

function parseSeedBytes(seedDigest) {
  requireSha(seedDigest, "seed_digest");
  const hex = seedDigest.slice("sha256:".length);
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function deriveParams(seedDigest) {
  const [b0, b1, b2] = parseSeedBytes(seedDigest);
  const p0 = b0 % RING_SIZE;
  let d = 1 + 2 * (b1 % 60);
  for (let i = 0; i < 60 && gcd(d, RING_SIZE) !== 1; i++) {
    d += 2;
    if (d > 119) d = 1;
  }
  if (gcd(d, RING_SIZE) !== 1) die("surface extract failed to find coprime d");
  const kMax = 1 + (b2 % K_MAX_LIMIT);
  return { p0, d, kMax };
}

function chordPairsByK(p0, d, kMax) {
  const out = [];
  for (let k = 1; k <= kMax; k++) {
    const a = (p0 + k * d) % RING_SIZE;
    const b = (p0 - k * d + RING_SIZE * 1000) % RING_SIZE;
    if (a === b) die("surface chord degenerate");
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    out.push({ lo: String(lo), hi: String(hi) });
  }
  return out;
}

function chordPairsCanonical(p0, d, kMax) {
  const out = chordPairsByK(p0, d, kMax);
  out.sort((x, y) => (x.lo === y.lo ? x.hi.localeCompare(y.hi) : x.lo.localeCompare(y.lo)));
  const set = new Set(out.map((x) => `${x.lo},${x.hi}`));
  if (set.size !== out.length) die("surface chords duplicate");
  return out;
}

function toIntInRange(s, min, max, ctx) {
  if (typeof s !== "string" || !/^[0-9]+$/.test(s)) die(`${ctx} invalid integer string`);
  const n = Number(s);
  if (!Number.isInteger(n) || n < min || n > max) die(`${ctx} out of range`);
  return n;
}

function validateSurface(x) {
  keyset(x, ["authority", "chords_digest", "d", "digest", "k_max", "p0", "ring_size", "seed_digest", "v"], "evidence_surface");
  if (x.v !== SURFACE_V) die("evidence_surface version mismatch");
  if (x.authority !== "advisory") die("evidence_surface authority must be advisory");
  requireSha(x.seed_digest, "evidence_surface.seed_digest");
  requireSha(x.chords_digest, "evidence_surface.chords_digest");
  requireSha(x.digest, "evidence_surface.digest");

  const ringSize = toIntInRange(x.ring_size, RING_SIZE, RING_SIZE, "evidence_surface.ring_size");
  const p0 = toIntInRange(x.p0, 0, ringSize - 1, "evidence_surface.p0");
  const d = toIntInRange(x.d, 1, 119, "evidence_surface.d");
  const kMax = toIntInRange(x.k_max, 1, K_MAX_LIMIT, "evidence_surface.k_max");

  const wantParams = deriveParams(x.seed_digest);
  if (wantParams.p0 !== p0 || wantParams.d !== d || wantParams.kMax !== kMax) {
    die("evidence_surface extraction mismatch vs seed_digest");
  }

  const chords = chordPairsCanonical(p0, d, kMax);
  const wantChordsDigest = shaPref(Buffer.from(canonicalJson(chords), "utf8"));
  if (wantChordsDigest !== x.chords_digest) die("evidence_surface chords_digest mismatch");

  requireStringMembrane(x, "evidence_surface");
  const body = {
    authority: x.authority,
    chords_digest: x.chords_digest,
    d: x.d,
    k_max: x.k_max,
    p0: x.p0,
    ring_size: x.ring_size,
    seed_digest: x.seed_digest,
    v: x.v,
  };
  const wantDigest = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (wantDigest !== x.digest) die("evidence_surface digest mismatch");
}

function buildSurface(seedDigest) {
  const { p0, d, kMax } = deriveParams(seedDigest);
  const chords = chordPairsCanonical(p0, d, kMax);
  const body = {
    authority: "advisory",
    chords_digest: shaPref(Buffer.from(canonicalJson(chords), "utf8")),
    d: String(d),
    k_max: String(kMax),
    p0: String(p0),
    ring_size: String(RING_SIZE),
    seed_digest: seedDigest,
    v: SURFACE_V,
  };
  return { ...body, digest: shaPref(Buffer.from(canonicalJson(body), "utf8")) };
}

function renderSurface(surface, mode) {
  const p0 = Number(surface.p0);
  const d = Number(surface.d);
  const kMax = Number(surface.k_max);
  const chords = chordPairsCanonical(p0, d, kMax);
  if (mode === "chords") {
    return {
      authority: "advisory",
      mode: "chords",
      ring_size: String(RING_SIZE),
      seed_digest: surface.seed_digest,
      chords,
      digest: shaPref(Buffer.from(canonicalJson({ authority: "advisory", mode: "chords", ring_size: String(RING_SIZE), seed_digest: surface.seed_digest, chords }), "utf8")),
    };
  }
  if (mode === "spiral") {
    const spiral = chords.map((c, i) => ({ index: String(i + 1), a: c.lo, b: c.hi, phase: String((i * d) % RING_SIZE) }));
    return {
      authority: "advisory",
      mode: "spiral",
      ring_size: String(RING_SIZE),
      seed_digest: surface.seed_digest,
      spiral,
      digest: shaPref(Buffer.from(canonicalJson({ authority: "advisory", mode: "spiral", ring_size: String(RING_SIZE), seed_digest: surface.seed_digest, spiral }), "utf8")),
    };
  }
  die("render mode must be chords|spiral");
}

function sortIdx(arr) {
  return [...arr].sort((a, b) => Number(a) - Number(b));
}

function validateIdxArray(arr, ctx) {
  if (!Array.isArray(arr)) die(`${ctx} must be array`);
  arr.forEach((s, i) => {
    toIntInRange(s, 0, RING_SIZE - 1, `${ctx}[${i}]`);
  });
  const sorted = sortIdx(arr);
  if (JSON.stringify(arr) !== JSON.stringify(sorted)) die(`${ctx} must be sorted ascending`);
  if (new Set(arr).size !== arr.length) die(`${ctx} contains duplicates`);
}

function validateFrame(frame) {
  keyset(frame, ["authority", "chord_dim", "chord_on", "digest", "mode", "pointer_on", "ring_size", "surface_digest", "t", "v"], "surface_frame");
  if (frame.v !== FRAME_V) die("surface_frame version mismatch");
  if (frame.authority !== "advisory") die("surface_frame authority must be advisory");
  if (frame.mode !== "leds240") die("surface_frame mode mismatch");
  if (frame.ring_size !== String(RING_SIZE)) die("surface_frame ring_size mismatch");
  requireSha(frame.surface_digest, "surface_frame.surface_digest");
  requireSha(frame.digest, "surface_frame.digest");
  toIntInRange(frame.t, 0, 10 ** 9, "surface_frame.t");

  validateIdxArray(frame.pointer_on, "surface_frame.pointer_on");
  validateIdxArray(frame.chord_on, "surface_frame.chord_on");
  validateIdxArray(frame.chord_dim, "surface_frame.chord_dim");

  // pointer can overlap chords by precedence; chord_on and chord_dim must be disjoint.
  const onSet = new Set(frame.chord_on);
  for (const x of frame.chord_dim) {
    if (onSet.has(x)) die("surface_frame chord_on intersects chord_dim");
  }

  requireStringMembrane(frame, "surface_frame");
  const body = {
    authority: frame.authority,
    chord_dim: frame.chord_dim,
    chord_on: frame.chord_on,
    mode: frame.mode,
    pointer_on: frame.pointer_on,
    ring_size: frame.ring_size,
    surface_digest: frame.surface_digest,
    t: frame.t,
    v: frame.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== frame.digest) die("surface_frame digest mismatch");
}

async function readPointerSchedule(pointerTracePath) {
  const rows = await readNdjson(pointerTracePath);
  if (rows.length === 0) die("pointer trace empty");
  return rows.map((r, i) => {
    if (!r || typeof r !== "object") die(`pointer trace row ${i + 1} invalid`);
    return String(toIntInRange(r.p_after, 0, RING_SIZE - 1, `pointer_trace[${i}].p_after`));
  });
}

function pointerAt(surface, t, pointerSchedule) {
  if (pointerSchedule && pointerSchedule.length > 0) {
    return pointerSchedule[t % pointerSchedule.length];
  }
  const p0 = Number(surface.p0);
  return String((p0 + t) % RING_SIZE);
}

function expectedFrame(surface, t, pointerSchedule) {
  const p0 = Number(surface.p0);
  const d = Number(surface.d);
  const kMax = Number(surface.k_max);
  const byK = chordPairsByK(p0, d, kMax);
  const idx = t % kMax;
  const prev = (t + kMax - 1) % kMax;

  const chordOn = sortIdx([byK[idx].lo, byK[idx].hi]);
  const chordDim = t === 0 ? [] : sortIdx([byK[prev].lo, byK[prev].hi]);
  const pointerOn = [pointerAt(surface, t, pointerSchedule)];

  const body = {
    authority: "advisory",
    chord_dim: chordDim,
    chord_on: chordOn,
    mode: "leds240",
    pointer_on: pointerOn,
    ring_size: String(RING_SIZE),
    surface_digest: surface.digest,
    t: String(t),
    v: FRAME_V,
  };
  return { ...body, digest: shaPref(Buffer.from(canonicalJson(body), "utf8")) };
}

function toFramesCount(x) {
  return toIntInRange(x, 1, 10000, "frames");
}

function idxArrayToMask(arr) {
  const buf = Buffer.alloc(30, 0);
  for (const s of arr) {
    const idx = Number(s);
    const bi = Math.floor(idx / 8);
    const bit = idx % 8;
    buf[bi] |= (1 << bit);
  }
  return buf;
}

function packEmitterFrame(frame, uartCrc) {
  if (uartCrc !== "none" && uartCrc !== UART_CRC_ID) die("uart crc mode unknown");
  const packetBytes = UART_PACKET_BYTES + (uartCrc === UART_CRC_ID ? 1 : 0);
  const buf = Buffer.alloc(packetBytes, 0);
  const t = Number(frame.t);
  const frameMs = Number(frame.frame_ms);
  const pointer = frame.pointer.length === 1 ? Number(frame.pointer[0]) : 0xff;
  const onMask = idxArrayToMask(frame.on);
  const dimMask = idxArrayToMask(frame.dim);

  buf[0] = 0x30; // wave30 transport version
  buf[1] = 0x01; // esp32.v0 profile
  buf.writeUInt16BE(t & 0xffff, 2);
  buf.writeUInt16BE(frameMs & 0xffff, 4);
  buf[6] = pointer;
  onMask.copy(buf, 7);
  dimMask.copy(buf, 37);
  if (uartCrc === UART_CRC_ID) {
    let crc = 0;
    for (let i = 0; i < UART_PACKET_BYTES; i++) crc ^= buf[i];
    buf[UART_PACKET_BYTES] = crc;
  }
  return buf;
}

function buildUartPacketRecord(surface, emitterFrame, uartCrc) {
  const packet = packEmitterFrame(emitterFrame, uartCrc);
  const packetHex = packet.toString("hex");
  const body = {
    authority: "advisory",
    frame_digest: emitterFrame.digest,
    packet_bytes: String(packet.length),
    packet_hex: packetHex,
    profile: "esp32.uart.v0",
    surface_digest: surface.digest,
    t: emitterFrame.t,
    uart_crc: uartCrc,
    v: UART_PACKET_V,
  };
  return { ...body, digest: shaPref(Buffer.from(canonicalJson(body), "utf8")) };
}

function packetHexToBuffer(x, bytes, ctx) {
  if (typeof x !== "string" || !/^[0-9a-f]+$/.test(x)) die(`${ctx} packet_hex invalid`);
  if (x.length !== bytes * 2) die(`${ctx} packet_hex length mismatch`);
  return Buffer.from(x, "hex");
}

function packetRowsToBuffer(rows) {
  return Buffer.concat(rows.map((r, i) => packetHexToBuffer(r.packet_hex, Number(r.packet_bytes), `surface_uart_packet[${i}]`)));
}

function validateUartPacketRecord(x) {
  keyset(x, ["authority", "digest", "frame_digest", "packet_bytes", "packet_hex", "profile", "surface_digest", "t", "uart_crc", "v"], "surface_uart_packet");
  if (x.v !== UART_PACKET_V) die("surface_uart_packet version mismatch");
  if (x.authority !== "advisory") die("surface_uart_packet authority must be advisory");
  if (x.profile !== "esp32.uart.v0") die("surface_uart_packet profile mismatch");
  if (x.uart_crc !== "none" && x.uart_crc !== UART_CRC_ID) die("surface_uart_packet uart_crc unknown");
  const wantBytes = UART_PACKET_BYTES + (x.uart_crc === UART_CRC_ID ? 1 : 0);
  if (x.packet_bytes !== String(wantBytes)) die("surface_uart_packet packet_bytes mismatch");
  requireSha(x.surface_digest, "surface_uart_packet.surface_digest");
  requireSha(x.frame_digest, "surface_uart_packet.frame_digest");
  requireSha(x.digest, "surface_uart_packet.digest");
  toIntInRange(x.t, 0, 10 ** 9, "surface_uart_packet.t");

  if (typeof x.packet_hex !== "string" || !/^[0-9a-f]+$/.test(x.packet_hex)) {
    die("surface_uart_packet packet_hex invalid");
  }
  if (x.packet_hex.length !== wantBytes * 2) {
    die("surface_uart_packet packet_hex length mismatch");
  }
  if (x.uart_crc === UART_CRC_ID) {
    const packet = Buffer.from(x.packet_hex, "hex");
    let crc = 0;
    for (let i = 0; i < UART_PACKET_BYTES; i++) crc ^= packet[i];
    if (packet[UART_PACKET_BYTES] !== crc) die("surface_uart_packet crc mismatch");
  }

  requireStringMembrane(x, "surface_uart_packet");
  const body = {
    authority: x.authority,
    frame_digest: x.frame_digest,
    packet_bytes: x.packet_bytes,
    packet_hex: x.packet_hex,
    profile: x.profile,
    surface_digest: x.surface_digest,
    t: x.t,
    uart_crc: x.uart_crc,
    v: x.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== x.digest) die("surface_uart_packet digest mismatch");
}

function unionSorted(a, b) {
  return sortIdx(Array.from(new Set([...a, ...b])));
}

function expectedEmitterFrame(surface, t, pointerSchedule, frameMs) {
  const base = expectedFrame(surface, t, pointerSchedule);
  const on = unionSorted(base.pointer_on, base.chord_on);
  const onSet = new Set(on);
  const dim = base.chord_dim.filter((x) => !onSet.has(x));

  const body = {
    authority: "advisory",
    dim,
    frame_ms: String(frameMs),
    mode: "leds240",
    on,
    pointer: base.pointer_on,
    profile: "esp32.v0",
    ring_size: String(RING_SIZE),
    surface_digest: surface.digest,
    t: String(t),
    v: EMITTER_FRAME_V,
  };
  return { ...body, digest: shaPref(Buffer.from(canonicalJson(body), "utf8")) };
}

function validateEmitterFrame(frame) {
  keyset(frame, ["authority", "digest", "dim", "frame_ms", "mode", "on", "pointer", "profile", "ring_size", "surface_digest", "t", "v"], "surface_emitter_frame");
  if (frame.v !== EMITTER_FRAME_V) die("surface_emitter_frame version mismatch");
  if (frame.authority !== "advisory") die("surface_emitter_frame authority must be advisory");
  if (frame.mode !== "leds240") die("surface_emitter_frame mode mismatch");
  if (frame.profile !== "esp32.v0") die("surface_emitter_frame profile mismatch");
  if (frame.ring_size !== String(RING_SIZE)) die("surface_emitter_frame ring_size mismatch");
  requireSha(frame.surface_digest, "surface_emitter_frame.surface_digest");
  requireSha(frame.digest, "surface_emitter_frame.digest");
  toIntInRange(frame.t, 0, 10 ** 9, "surface_emitter_frame.t");
  toIntInRange(frame.frame_ms, 1, 5000, "surface_emitter_frame.frame_ms");

  validateIdxArray(frame.on, "surface_emitter_frame.on");
  validateIdxArray(frame.dim, "surface_emitter_frame.dim");
  validateIdxArray(frame.pointer, "surface_emitter_frame.pointer");
  if (frame.pointer.length > 1) die("surface_emitter_frame.pointer max length is 1");

  const onSet = new Set(frame.on);
  const dimSet = new Set(frame.dim);
  for (const x of frame.pointer) {
    if (!onSet.has(x)) die("surface_emitter_frame.pointer must be subset of on");
  }
  for (const x of frame.dim) {
    if (onSet.has(x)) die("surface_emitter_frame on intersects dim");
  }
  if (dimSet.size !== frame.dim.length) die("surface_emitter_frame dim duplicates");

  requireStringMembrane(frame, "surface_emitter_frame");
  const body = {
    authority: frame.authority,
    dim: frame.dim,
    frame_ms: frame.frame_ms,
    mode: frame.mode,
    on: frame.on,
    pointer: frame.pointer,
    profile: frame.profile,
    ring_size: frame.ring_size,
    surface_digest: frame.surface_digest,
    t: frame.t,
    v: frame.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== frame.digest) die("surface_emitter_frame digest mismatch");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.mode) {
    console.log("mv-evidence-surface build --seed-digest <sha256:...> --out <surface.json>");
    console.log("mv-evidence-surface verify --in <surface.json>");
    console.log("mv-evidence-surface render --in <surface.json> --mode chords|spiral --out <render.json>");
    console.log("mv-evidence-surface render-leds240 --surface <surface.json> --out <frames.ndjson> [--frames 12] [--pointer-trace <wave27.ndjson>]");
    console.log("mv-evidence-surface verify-leds240 --surface <surface.json> --in <frames.ndjson> [--pointer-trace <wave27.ndjson>]");
    console.log("mv-evidence-surface render-leds240-esp32 --surface <surface.json> --out <emitter.ndjson> [--frames 12] [--frame-ms 50] [--pointer-trace <wave27.ndjson>]");
    console.log("mv-evidence-surface verify-leds240-esp32 --surface <surface.json> --in <emitter.ndjson> [--frame-ms 50] [--pointer-trace <wave27.ndjson>]");
    console.log("mv-evidence-surface emit-esp32-uart --surface <surface.json> --emitter <emitter.ndjson> --out <packets.ndjson> [--out-bin <packets.bin>] [--uart-crc none|crc8-xor-v0]");
    console.log("mv-evidence-surface verify-esp32-uart --surface <surface.json> --emitter <emitter.ndjson> --in <packets.ndjson> [--in-bin <packets.bin>] [--uart-crc none|crc8-xor-v0]");
    return;
  }

  if (args.mode === "build") {
    if (!args.seedDigest || !args.out) die("build requires --seed-digest --out");
    const out = buildSurface(args.seedDigest);
    validateSurface(out);
    await writeJson(args.out, out);
    console.log(`ok mv-evidence-surface build digest=${out.digest}`);
    return;
  }

  if (args.mode === "verify") {
    if (!args.input) die("verify requires --in");
    const x = await readJson(args.input);
    validateSurface(x);
    console.log(`ok mv-evidence-surface verify digest=${x.digest}`);
    return;
  }

  if (args.mode === "render") {
    if (!args.input || !args.out) die("render requires --in --out");
    const x = await readJson(args.input);
    validateSurface(x);
    const rendered = renderSurface(x, args.modeRender);
    await writeJson(args.out, rendered);
    console.log(`ok mv-evidence-surface render mode=${args.modeRender} digest=${rendered.digest}`);
    return;
  }

  if (args.mode === "render-leds240") {
    if (!args.surface || !args.out) die("render-leds240 requires --surface --out");
    const surface = await readJson(args.surface);
    validateSurface(surface);
    const frames = toFramesCount(args.frames);
    const pointerSchedule = args.pointerTrace ? await readPointerSchedule(args.pointerTrace) : null;
    const rows = [];
    for (let t = 0; t < frames; t++) rows.push(expectedFrame(surface, t, pointerSchedule));
    await writeNdjson(args.out, rows);
    console.log(`ok mv-evidence-surface render-leds240 frames=${frames}`);
    return;
  }

  if (args.mode === "verify-leds240") {
    if (!args.surface || !args.input) die("verify-leds240 requires --surface --in");
    const surface = await readJson(args.surface);
    validateSurface(surface);
    const pointerSchedule = args.pointerTrace ? await readPointerSchedule(args.pointerTrace) : null;
    const rows = await readNdjson(args.input);
    if (rows.length === 0) die("frames NDJSON empty");
    for (let i = 0; i < rows.length; i++) {
      const got = rows[i];
      validateFrame(got);
      if (got.surface_digest !== surface.digest) die(`frame ${i} surface_digest mismatch`);
      const t = toIntInRange(got.t, 0, 10 ** 9, `frame[${i}].t`);
      if (t !== i) die(`frame ${i} t sequence mismatch`);
      const exp = expectedFrame(surface, t, pointerSchedule);
      if (canonicalJson(got) !== canonicalJson(exp)) die(`frame ${i} recompute mismatch`);
    }
    console.log(`ok mv-evidence-surface verify-leds240 frames=${rows.length}`);
    return;
  }

  if (args.mode === "render-leds240-esp32") {
    if (!args.surface || !args.out) die("render-leds240-esp32 requires --surface --out");
    const surface = await readJson(args.surface);
    validateSurface(surface);
    const frames = toFramesCount(args.frames);
    const frameMs = toIntInRange(args.frameMs, 1, 5000, "frame_ms");
    const pointerSchedule = args.pointerTrace ? await readPointerSchedule(args.pointerTrace) : null;
    const rows = [];
    for (let t = 0; t < frames; t++) rows.push(expectedEmitterFrame(surface, t, pointerSchedule, frameMs));
    await writeNdjson(args.out, rows);
    console.log(`ok mv-evidence-surface render-leds240-esp32 frames=${frames} frame_ms=${frameMs}`);
    return;
  }

  if (args.mode === "verify-leds240-esp32") {
    if (!args.surface || !args.input) die("verify-leds240-esp32 requires --surface --in");
    const surface = await readJson(args.surface);
    validateSurface(surface);
    const frameMs = toIntInRange(args.frameMs, 1, 5000, "frame_ms");
    const pointerSchedule = args.pointerTrace ? await readPointerSchedule(args.pointerTrace) : null;
    const rows = await readNdjson(args.input);
    if (rows.length === 0) die("emitter NDJSON empty");
    for (let i = 0; i < rows.length; i++) {
      const got = rows[i];
      validateEmitterFrame(got);
      if (got.surface_digest !== surface.digest) die(`emitter frame ${i} surface_digest mismatch`);
      const t = toIntInRange(got.t, 0, 10 ** 9, `emitter_frame[${i}].t`);
      if (t !== i) die(`emitter frame ${i} t sequence mismatch`);
      if (got.frame_ms !== String(frameMs)) die(`emitter frame ${i} frame_ms mismatch`);
      const exp = expectedEmitterFrame(surface, t, pointerSchedule, frameMs);
      if (canonicalJson(got) !== canonicalJson(exp)) die(`emitter frame ${i} recompute mismatch`);
    }
    console.log(`ok mv-evidence-surface verify-leds240-esp32 frames=${rows.length} frame_ms=${frameMs}`);
    return;
  }

  if (args.mode === "emit-esp32-uart") {
    if (!args.surface || !args.emitter || !args.out) die("emit-esp32-uart requires --surface --emitter --out");
    const surface = await readJson(args.surface);
    validateSurface(surface);
    const emitterRows = await readNdjson(args.emitter);
    if (emitterRows.length === 0) die("emitter NDJSON empty");
    if (args.uartCrc !== "none" && args.uartCrc !== UART_CRC_ID) die("uart crc mode unknown");
    const outRows = [];
    for (let i = 0; i < emitterRows.length; i++) {
      const f = emitterRows[i];
      validateEmitterFrame(f);
      if (f.surface_digest !== surface.digest) die(`emitter frame ${i} surface_digest mismatch`);
      const t = toIntInRange(f.t, 0, 10 ** 9, `emitter_frame[${i}].t`);
      if (t !== i) die(`emitter frame ${i} t sequence mismatch`);
      outRows.push(buildUartPacketRecord(surface, f, args.uartCrc));
    }
    await writeNdjson(args.out, outRows);
    if (args.outBin) {
      const bin = packetRowsToBuffer(outRows);
      await writeBin(args.outBin, bin);
    }
    console.log(`ok mv-evidence-surface emit-esp32-uart frames=${outRows.length}`);
    return;
  }

  if (args.mode === "verify-esp32-uart") {
    if (!args.surface || !args.emitter || !args.input) die("verify-esp32-uart requires --surface --emitter --in");
    const surface = await readJson(args.surface);
    validateSurface(surface);
    const emitterRows = await readNdjson(args.emitter);
    const packetRows = await readNdjson(args.input);
    if (emitterRows.length === 0) die("emitter NDJSON empty");
    if (packetRows.length === 0) die("uart packets NDJSON empty");
    if (emitterRows.length !== packetRows.length) die("uart packet count mismatch");
    if (args.uartCrc !== "none" && args.uartCrc !== UART_CRC_ID) die("uart crc mode unknown");
    for (let i = 0; i < emitterRows.length; i++) {
      const f = emitterRows[i];
      validateEmitterFrame(f);
      if (f.surface_digest !== surface.digest) die(`emitter frame ${i} surface_digest mismatch`);
      const t = toIntInRange(f.t, 0, 10 ** 9, `emitter_frame[${i}].t`);
      if (t !== i) die(`emitter frame ${i} t sequence mismatch`);
      const got = packetRows[i];
      validateUartPacketRecord(got);
      if (got.surface_digest !== surface.digest) die(`uart packet ${i} surface_digest mismatch`);
      if (got.frame_digest !== f.digest) die(`uart packet ${i} frame_digest mismatch`);
      if (got.uart_crc !== args.uartCrc) die(`uart packet ${i} uart_crc mismatch`);
      const exp = buildUartPacketRecord(surface, f, args.uartCrc);
      if (canonicalJson(got) !== canonicalJson(exp)) die(`uart packet ${i} recompute mismatch`);
    }
    if (args.inputBin) {
      const raw = await readBin(args.inputBin);
      const expRaw = packetRowsToBuffer(packetRows);
      if (raw.length !== expRaw.length) die("uart bin length mismatch");
      if (!raw.equals(expRaw)) die("uart bin content mismatch");
    }
    console.log(`ok mv-evidence-surface verify-esp32-uart packets=${packetRows.length}`);
    return;
  }

  die("mode must be build|verify|render|render-leds240|verify-leds240|render-leds240-esp32|verify-leds240-esp32|emit-esp32-uart|verify-esp32-uart");
}

main().catch((e) => die(e.message || String(e)));
