#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const TRACE_VERSION = "wave27.pointer_sync.v0";
const RESIDUAL_VERSION = "wave27.pointer_sync_residual.v0";
const RING_BASIS_VERSION = "wave27.ring_basis.v0";
const TURN_CLOCK_ID = "wave27.turn_clock.delta12.v0";
const TURN_PROJECT_ID = "wave27.turn_project.delta12_line_res.v0";
const REFLECT_ID = "wave27.reflect.parity_p.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const DIGITS_RE = /^[0-9]+$/;

const DELTA_C241_0 = [1, 3, 5, 7, 11, 13];
const DELTA_C241_1 = [2, 4, 6, 8, 12, 14];
const B_LINE = [17, 19, 23, 29, 31, 37];
const B_RES = [41, 43, 47, 53, 59, 61];

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalJson(obj) {
  return `${stableStringify(obj)}\n`;
}

function shaPref(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function keyset(obj, expected, ctx) {
  const got = Object.keys(obj).sort().join(",");
  const want = [...expected].sort().join(",");
  if (got !== want) die(`${ctx} keyset mismatch`);
}

function requireSha(v, ctx) {
  if (typeof v !== "string" || !SHA_RE.test(v)) die(`${ctx} invalid sha256`);
}

function requireStringMembrane(v, ctx) {
  if (Array.isArray(v)) {
    v.forEach((inner, i) => requireStringMembrane(inner, `${ctx}[${i}]`));
    return;
  }
  if (v && typeof v === "object") {
    for (const [k, inner] of Object.entries(v)) requireStringMembrane(inner, `${ctx}.${k}`);
    return;
  }
  if (typeof v !== "string") die(`${ctx} violates string membrane`);
}

function parseUIntString(v, ctx) {
  if (typeof v !== "string" || !DIGITS_RE.test(v)) die(`${ctx} must be unsigned decimal string`);
  return Number(v);
}

function parseBit(v, ctx) {
  if (v !== "0" && v !== "1") die(`${ctx} must be bit string 0|1`);
  return Number(v);
}

function parseOuter(bits, ctx) {
  if (typeof bits !== "string" || !/^[01]{6}$/.test(bits)) die(`${ctx} must be 6-bit string`);
  return bits.split("").map((ch) => Number(ch));
}

function parseArgs(argv) {
  const out = { mode: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "simulate") out.mode = "simulate";
    else if (a === "verify") out.mode = "verify";
    else if (a === "emit-ring-basis") out.mode = "emit-ring-basis";
    else if (a === "--steps" && argv[i + 1]) out.steps = argv[++i];
    else if (a === "--p0" && argv[i + 1]) out.p0 = argv[++i];
    else if (a === "--c2410" && argv[i + 1]) out.c2410 = argv[++i];
    else if (a === "--k0" && argv[i + 1]) out.k0 = argv[++i];
    else if (a === "--a-c7" && argv[i + 1]) out.aC7 = argv[++i];
    else if (a === "--a-outer" && argv[i + 1]) out.aOuter = argv[++i];
    else if (a === "--b-c7" && argv[i + 1]) out.bC7 = argv[++i];
    else if (a === "--b-outer" && argv[i + 1]) out.bOuter = argv[++i];
    else if (a === "--in" && argv[i + 1]) out.input = argv[++i];
    else if (a === "--ring-basis" && argv[i + 1]) out.ringBasis = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--out-residual" && argv[i + 1]) out.outResidual = argv[++i];
    else if (a === "--help" || a === "-h") out.help = "1";
    else die(`unknown arg: ${a}`);
  }
  return out;
}

async function readJson(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  return JSON.parse(await fs.readFile(abs, "utf8"));
}

async function writeCanonicalJson(filePath, obj) {
  const abs = path.resolve(process.cwd(), filePath);
  await fs.writeFile(abs, canonicalJson(obj), "utf8");
}

async function readNdjson(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(abs, "utf8");
  if (!raw.endsWith("\n")) die("trace NDJSON must end with newline");
  const rows = raw.split("\n");
  rows.pop();
  if (rows.length === 0) die("trace NDJSON must contain at least one record");
  const records = [];
  for (const [i, line] of rows.entries()) {
    if (line.length === 0) die(`trace line ${i + 1} must not be empty`);
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      die(`trace line ${i + 1} invalid JSON`);
    }
    if (`${stableStringify(parsed)}` !== line) {
      die(`trace line ${i + 1} must be canonical JSON`);
    }
    records.push(parsed);
  }
  return records;
}

function delta(k, c241) {
  if (k < 1 || k > 6) die(`k out of range: ${k}`);
  if (c241 !== 0 && c241 !== 1) die(`c241 out of range: ${c241}`);
  return c241 === 0 ? DELTA_C241_0[k - 1] : DELTA_C241_1[k - 1];
}

function turnProject(p, k, line, r, c241) {
  if (p < 0 || p > 239) die(`p out of range: ${p}`);
  if (![0, 1].includes(line)) die(`line out of range: ${line}`);
  if (![0, 1].includes(r)) die(`r out of range: ${r}`);
  const base = delta(k, c241);
  return (p + base + (line ? B_LINE[k - 1] : 0) + (r ? B_RES[k - 1] : 0)) % 240;
}

function reflect(p) {
  if (p < 0 || p > 239) die(`reflect p out of range: ${p}`);
  return p % 2;
}

function parsePeerArgs(args) {
  const aC7 = parseBit(args.aC7 ?? "", "--a-c7");
  const bC7 = parseBit(args.bC7 ?? "", "--b-c7");
  const aOuter = parseOuter(args.aOuter ?? "", "--a-outer");
  const bOuter = parseOuter(args.bOuter ?? "", "--b-outer");
  return { aC7, bC7, aOuter, bOuter };
}

function ensureFrozenIds(rec) {
  if (rec.turn_clock_id !== TURN_CLOCK_ID) die("unknown turn_clock_id");
  if (rec.turn_project_id !== TURN_PROJECT_ID) die("unknown turn_project_id");
  if (rec.reflect_id !== REFLECT_ID) die("unknown reflect_id");
}

function traceDigestBody(rec) {
  const body = { ...rec };
  delete body.digest;
  return body;
}

function validateRingBasis(basis) {
  keyset(basis, ["authority", "basis", "digest", "size", "v"], "ring_basis");
  if (basis.v !== RING_BASIS_VERSION) die("ring_basis version mismatch");
  if (basis.authority !== "advisory") die("ring_basis authority must be advisory");
  if (basis.size !== "240") die("ring_basis size must be 240");
  if (basis.basis !== "identity") die("ring_basis basis must be identity");
  requireSha(basis.digest, "ring_basis.digest");
  requireStringMembrane(basis, "ring_basis");
  const want = shaPref(Buffer.from(canonicalJson({ authority: basis.authority, basis: basis.basis, size: basis.size, v: basis.v }), "utf8"));
  if (want !== basis.digest) die("ring_basis digest mismatch");
}

function validateTraceRecord(rec, lineIdx) {
  const ctx = `trace[${lineIdx}]`;
  keyset(rec, ["authority", "c241_after", "c241_before", "digest", "k", "p_after", "p_before", "reflect_id", "ring_fingerprint", "status", "step", "turn_clock_id", "turn_project_id", "v"], ctx);
  if (rec.v !== TRACE_VERSION) die(`${ctx}.v mismatch`);
  if (rec.authority !== "advisory") die(`${ctx}.authority must be advisory`);
  ensureFrozenIds(rec);
  if (rec.status !== "commit" && rec.status !== "fail") die(`${ctx}.status invalid`);
  requireSha(rec.ring_fingerprint, `${ctx}.ring_fingerprint`);
  requireSha(rec.digest, `${ctx}.digest`);

  const step = parseUIntString(rec.step, `${ctx}.step`);
  const k = parseUIntString(rec.k, `${ctx}.k`);
  const pBefore = parseUIntString(rec.p_before, `${ctx}.p_before`);
  const pAfter = parseUIntString(rec.p_after, `${ctx}.p_after`);
  parseBit(rec.c241_before, `${ctx}.c241_before`);
  parseBit(rec.c241_after, `${ctx}.c241_after`);
  if (k < 1 || k > 6) die(`${ctx}.k out of range`);
  if (pBefore < 0 || pBefore > 239) die(`${ctx}.p_before out of range`);
  if (pAfter < 0 || pAfter > 239) die(`${ctx}.p_after out of range`);
  if (step < 1) die(`${ctx}.step out of range`);

  requireStringMembrane(rec, ctx);
  const wantDigest = shaPref(Buffer.from(canonicalJson(traceDigestBody(rec)), "utf8"));
  if (wantDigest !== rec.digest) die(`${ctx}.digest mismatch`);
}

function buildRingBasis() {
  const body = {
    authority: "advisory",
    basis: "identity",
    size: "240",
    v: RING_BASIS_VERSION,
  };
  return {
    ...body,
    digest: shaPref(Buffer.from(canonicalJson(body), "utf8")),
  };
}

function buildResidual(stepK, pBefore, candidateA, candidateB, ringFingerprint) {
  const body = {
    authority: "advisory",
    candidate_a: String(candidateA),
    candidate_b: String(candidateB),
    fail_k: String(stepK),
    p_before: String(pBefore),
    reflect_id: REFLECT_ID,
    ring_fingerprint: ringFingerprint,
    turn_clock_id: TURN_CLOCK_ID,
    turn_project_id: TURN_PROJECT_ID,
    v: RESIDUAL_VERSION,
  };
  return {
    ...body,
    digest: shaPref(Buffer.from(canonicalJson(body), "utf8")),
  };
}

function buildTraceLine(state, stepNumber, status, pAfter, c241After, ringFingerprint) {
  const body = {
    authority: "advisory",
    c241_after: String(c241After),
    c241_before: String(state.c241),
    k: String(state.k),
    p_after: String(pAfter),
    p_before: String(state.p),
    reflect_id: REFLECT_ID,
    ring_fingerprint: ringFingerprint,
    status,
    step: String(stepNumber),
    turn_clock_id: TURN_CLOCK_ID,
    turn_project_id: TURN_PROJECT_ID,
    v: TRACE_VERSION,
  };
  return {
    ...body,
    digest: shaPref(Buffer.from(canonicalJson(body), "utf8")),
  };
}

function simulateRecords(config) {
  const records = [];
  let residual = null;
  let state = { p: config.p0, c241: config.c2410, k: config.k0 };

  for (let step = 1; step <= config.steps; step++) {
    const lineA = config.aOuter[state.k - 1];
    const lineB = config.bOuter[state.k - 1];
    const rA = config.aC7 ^ state.c241;
    const rB = config.bC7 ^ state.c241;

    const candidateA = turnProject(state.p, state.k, lineA, rA, state.c241);
    const candidateB = turnProject(state.p, state.k, lineB, rB, state.c241);

    if (candidateA === candidateB) {
      const pAfter = candidateA;
      const c241After = reflect(pAfter);
      const rec = buildTraceLine(state, step, "commit", pAfter, c241After, config.ringFingerprint);
      records.push(rec);
      state = {
        p: pAfter,
        c241: c241After,
        k: (state.k % 6) + 1,
      };
      continue;
    }

    const rec = buildTraceLine(state, step, "fail", state.p, state.c241, config.ringFingerprint);
    records.push(rec);
    residual = buildResidual(state.k, state.p, candidateA, candidateB, config.ringFingerprint);
    break;
  }

  return { records, residual };
}

async function cmdEmitRingBasis(args) {
  if (!args.out) die("emit-ring-basis requires --out");
  const basis = buildRingBasis();
  validateRingBasis(basis);
  await writeCanonicalJson(args.out, basis);
  console.log(`ok mv-pointer-sync emit-ring-basis digest=${basis.digest}`);
}

async function cmdSimulate(args) {
  if (!args.out) die("simulate requires --out");
  if (!args.ringBasis) die("simulate requires --ring-basis");

  const steps = parseUIntString(args.steps ?? "12", "--steps");
  if (steps < 1) die("--steps must be >= 1");

  const p0 = parseUIntString(args.p0 ?? "0", "--p0");
  const c2410 = parseBit(args.c2410 ?? "0", "--c2410");
  const k0 = parseUIntString(args.k0 ?? "1", "--k0");
  if (p0 < 0 || p0 > 239) die("--p0 out of range");
  if (k0 < 1 || k0 > 6) die("--k0 out of range");

  const peers = parsePeerArgs(args);
  const ringBasis = await readJson(args.ringBasis);
  validateRingBasis(ringBasis);

  const { records, residual } = simulateRecords({
    steps,
    p0,
    c2410,
    k0,
    ringFingerprint: ringBasis.digest,
    ...peers,
  });

  await fs.writeFile(path.resolve(process.cwd(), args.out), records.map((r) => canonicalJson(r)).join(""), "utf8");
  if (args.outResidual && residual) {
    await writeCanonicalJson(args.outResidual, residual);
  }

  const endStatus = records[records.length - 1].status;
  const traceDigest = shaPref(Buffer.from(records.map((r) => r.digest).join("\n"), "utf8"));
  console.log(`ok mv-pointer-sync simulate status=${endStatus} records=${records.length} trace_digest=${traceDigest}`);
}

async function cmdVerify(args) {
  if (!args.input) die("verify requires --in");
  if (!args.ringBasis) die("verify requires --ring-basis");

  const peers = parsePeerArgs(args);
  const ringBasis = await readJson(args.ringBasis);
  validateRingBasis(ringBasis);

  const records = await readNdjson(args.input);

  let expectedStep = 1;
  let state = null;

  for (const [i, rec] of records.entries()) {
    validateTraceRecord(rec, i);
    if (rec.ring_fingerprint !== ringBasis.digest) {
      die(`trace[${i}].ring_fingerprint mismatch vs ring_basis.digest`);
    }

    const step = Number(rec.step);
    const k = Number(rec.k);
    const pBefore = Number(rec.p_before);
    const c241Before = Number(rec.c241_before);
    const pAfter = Number(rec.p_after);
    const c241After = Number(rec.c241_after);

    if (step !== expectedStep) die(`trace[${i}].step sequence mismatch`);
    expectedStep += 1;

    if (state === null) {
      state = { p: pBefore, c241: c241Before, k };
    } else {
      if (state.p !== pBefore) die(`trace[${i}].p_before chain mismatch`);
      if (state.c241 !== c241Before) die(`trace[${i}].c241_before chain mismatch`);
      if (state.k !== k) die(`trace[${i}].k chain mismatch`);
    }

    const lineA = peers.aOuter[k - 1];
    const lineB = peers.bOuter[k - 1];
    const rA = peers.aC7 ^ c241Before;
    const rB = peers.bC7 ^ c241Before;

    const candidateA = turnProject(pBefore, k, lineA, rA, c241Before);
    const candidateB = turnProject(pBefore, k, lineB, rB, c241Before);

    if (candidateA === candidateB) {
      if (rec.status !== "commit") die(`trace[${i}] status mismatch: expected commit`);
      if (pAfter !== candidateA) die(`trace[${i}] p_after replay mismatch`);
      if (c241After !== reflect(pAfter)) die(`trace[${i}] c241_after replay mismatch`);
      state = { p: pAfter, c241: c241After, k: (k % 6) + 1 };
      continue;
    }

    if (rec.status !== "fail") die(`trace[${i}] status mismatch: expected fail`);
    if (pAfter !== pBefore) die(`trace[${i}] fail p_after must equal p_before`);
    if (c241After !== c241Before) die(`trace[${i}] fail c241_after must equal c241_before`);
    state = { p: pBefore, c241: c241Before, k };
  }

  const topDigest = shaPref(Buffer.from(records.map((r) => r.digest).join("\n"), "utf8"));
  console.log(`ok mv-pointer-sync verify records=${records.length} trace_digest=${topDigest}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-pointer-sync emit-ring-basis --out <ring-basis.v0.json>");
    console.log("mv-pointer-sync simulate --ring-basis <ring-basis.v0.json> --steps <N> --a-c7 <0|1> --a-outer <6 bits> --b-c7 <0|1> --b-outer <6 bits> --out <trace.ndjson> [--p0 0 --c2410 0 --k0 1 --out-residual <residual.v0.json>]");
    console.log("mv-pointer-sync verify --in <trace.ndjson> --ring-basis <ring-basis.v0.json> --a-c7 <0|1> --a-outer <6 bits> --b-c7 <0|1> --b-outer <6 bits>");
    return;
  }

  if (args.mode === "emit-ring-basis") {
    await cmdEmitRingBasis(args);
    return;
  }
  if (args.mode === "simulate") {
    await cmdSimulate(args);
    return;
  }
  if (args.mode === "verify") {
    await cmdVerify(args);
    return;
  }

  die("mode must be emit-ring-basis|simulate|verify");
}

main().catch((e) => die(e.message || String(e)));
