#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const TAPE_VERSION = "wave16.interaction_tape.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const VERBS = new Set([
  "OPEN_PASSAGE",
  "SET_STANCE",
  "SELECT_GENERATOR",
  "GENERATE_PROPOSAL",
  "FOCUS_NODE",
  "MOVE_ENTITY_PROPOSAL",
]);
const STANCES = new Set(["solon", "solomon", "asabiyyah", "metatron"]);
const SOLON_GENERATOR = "wave16.gen.solon.constitution.v0";

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "emit") out.mode = "emit";
    else if (a === "validate") out.mode = "validate";
    else if (a === "--base-bundle-digest" && argv[i + 1]) out.base = argv[++i];
    else if (a === "--narrative-state" && argv[i + 1]) out.narrative = argv[++i];
    else if (a === "--steps" && argv[i + 1]) out.steps = argv[++i];
    else if (a === "--tape" && argv[i + 1]) out.tape = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--help" || a === "-h") out.help = "1";
    else die(`unknown arg: ${a}`);
  }
  return out;
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
  if (typeof v !== "string" || !SHA_RE.test(v)) die(`${ctx} invalid sha256 format`);
}

function requireStringMembrane(obj, ctx = "root") {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => requireStringMembrane(v, `${ctx}[${i}]`));
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) requireStringMembrane(v, `${ctx}.${k}`);
    return;
  }
  if (typeof obj !== "string") die(`${ctx} violates string membrane`);
}

function narrativeDigest(bytes) {
  return shaPref(bytes);
}

function eventDigest(eventWithoutDigest) {
  return shaPref(Buffer.from(canonicalJson(eventWithoutDigest), "utf8"));
}

function validateTargetResolution(event, idx, narrativeIds) {
  if (!VERBS.has(event.verb)) die(`events[${idx}].verb unknown`);
  if (event.verb === "OPEN_PASSAGE" && !narrativeIds.has(event.target)) {
    die(`events[${idx}].target unresolved narrative passage`);
  }
  if (event.verb === "SET_STANCE" && !STANCES.has(event.target)) {
    die(`events[${idx}].target invalid stance`);
  }
  if ((event.verb === "SELECT_GENERATOR" || event.verb === "GENERATE_PROPOSAL") && event.target !== SOLON_GENERATOR) {
    die(`events[${idx}].target invalid generator`);
  }
  if ((event.verb === "FOCUS_NODE" || event.verb === "MOVE_ENTITY_PROPOSAL") && !SHA_RE.test(event.target)) {
    die(`events[${idx}].target invalid spatial target`);
  }
}

function buildEvents(rawSteps, narrativeIds) {
  if (!Array.isArray(rawSteps)) die("steps must be array");
  const events = [];
  for (let i = 0; i < rawSteps.length; i++) {
    const step = rawSteps[i];
    if (!step || typeof step !== "object" || Array.isArray(step)) die(`steps[${i}] must be object`);
    keyset(step, ["params", "target", "verb"], `steps[${i}]`);
    if (typeof step.verb !== "string" || typeof step.target !== "string") die(`steps[${i}] verb/target must be string`);
    if (!step.params || typeof step.params !== "object" || Array.isArray(step.params)) die(`steps[${i}].params must be object`);
    requireStringMembrane(step.params, `steps[${i}].params`);
    validateTargetResolution(step, i, narrativeIds);
    const t = String(i);
    const prev = i === 0 ? "genesis" : events[i - 1].digest;
    const eventCore = {
      params: step.params,
      prev,
      t,
      target: step.target,
      verb: step.verb,
    };
    const digest = eventDigest(eventCore);
    events.push({ ...eventCore, digest });
  }
  return events;
}

function validateEvents(events, narrativeIds) {
  if (!Array.isArray(events)) die("events must be array");
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    keyset(e, ["digest", "params", "prev", "t", "target", "verb"], `events[${i}]`);
    if (e.t !== String(i)) die(`events[${i}].t must be contiguous`);
    if (i === 0) {
      if (e.prev !== "genesis") die("events[0].prev must be genesis");
    } else if (e.prev !== events[i - 1].digest) {
      die(`events[${i}].prev linkage mismatch`);
    }
    validateTargetResolution(e, i, narrativeIds);
    if (!e.params || typeof e.params !== "object" || Array.isArray(e.params)) die(`events[${i}].params must be object`);
    requireStringMembrane(e.params, `events[${i}].params`);
    const core = { params: e.params, prev: e.prev, t: e.t, target: e.target, verb: e.verb };
    const want = eventDigest(core);
    if (want !== e.digest) die(`events[${i}].digest mismatch`);
  }
}

async function loadNarrativeModel(p) {
  const narrativePath = path.resolve(process.cwd(), p);
  const bytes = await fs.readFile(narrativePath);
  const obj = JSON.parse(bytes.toString("utf8"));
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) die("narrative state must be object");
  if (obj.v !== "wave16.narrative_state.v0") die("narrative state version mismatch");
  if (!Array.isArray(obj.states)) die("narrative state missing states");
  const ids = new Set();
  for (const [i, s] of obj.states.entries()) {
    if (!s || typeof s !== "object" || Array.isArray(s)) die(`narrative.states[${i}] invalid`);
    if (typeof s.id !== "string") die(`narrative.states[${i}].id missing`);
    ids.add(s.id);
  }
  return { bytes, obj, ids };
}

function buildTape(baseDigest, narrativeDigestValue, events) {
  requireSha(baseDigest, "base_bundle_digest");
  requireSha(narrativeDigestValue, "narrative_state_digest");
  const payload = {
    authority: "advisory",
    base_bundle_digest: baseDigest,
    events,
    narrative_state_digest: narrativeDigestValue,
    v: TAPE_VERSION,
  };
  const digest = shaPref(Buffer.from(canonicalJson(payload), "utf8"));
  return { ...payload, digest };
}

function validateTape(tape) {
  keyset(tape, ["authority", "base_bundle_digest", "digest", "events", "narrative_state_digest", "v"], "tape");
  if (tape.v !== TAPE_VERSION) die("tape version mismatch");
  if (tape.authority !== "advisory") die("tape authority must be advisory");
  requireSha(tape.base_bundle_digest, "tape.base_bundle_digest");
  requireSha(tape.narrative_state_digest, "tape.narrative_state_digest");
  requireSha(tape.digest, "tape.digest");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-interaction-tape emit --base-bundle-digest <sha256:...> --narrative-state <state.json> --steps <steps.json> --out <tape.json>");
    console.log("mv-interaction-tape validate --narrative-state <state.json> --tape <tape.json>");
    return;
  }

  if (args.mode === "emit") {
    if (!args.base || !args.narrative || !args.steps || !args.out) die("emit requires --base-bundle-digest --narrative-state --steps --out");
    const narrative = await loadNarrativeModel(args.narrative);
    const steps = JSON.parse((await fs.readFile(path.resolve(process.cwd(), args.steps), "utf8")));
    const events = buildEvents(steps, narrative.ids);
    const tape = buildTape(args.base, narrativeDigest(narrative.bytes), events);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(tape), "utf8");
    console.log(`ok mv-interaction-tape emit digest=${tape.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.narrative || !args.tape) die("validate requires --narrative-state --tape");
    const narrative = await loadNarrativeModel(args.narrative);
    const tape = JSON.parse(await fs.readFile(path.resolve(process.cwd(), args.tape), "utf8"));
    validateTape(tape);
    if (tape.narrative_state_digest !== narrativeDigest(narrative.bytes)) die("tape narrative_state_digest mismatch");
    validateEvents(tape.events, narrative.ids);
    const payload = {
      authority: tape.authority,
      base_bundle_digest: tape.base_bundle_digest,
      events: tape.events,
      narrative_state_digest: tape.narrative_state_digest,
      v: tape.v,
    };
    const want = shaPref(Buffer.from(canonicalJson(payload), "utf8"));
    if (want !== tape.digest) die("tape digest mismatch");
    console.log(`ok mv-interaction-tape validate digest=${tape.digest}`);
    return;
  }

  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
