#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave18.dialogue_grammar.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const VERBS = new Set(["OPEN_PASSAGE", "SET_STANCE", "SELECT_GENERATOR", "GENERATE_PROPOSAL"]);
const ARTIFACT_TYPES = new Set([
  "wave16.interaction_tape.v0",
  "wave16.proposal_bundle.v0",
  "wave17.shared_tape.v0",
]);

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
    v.forEach((item, i) => requireStringMembrane(item, `${ctx}[${i}]`));
    return;
  }
  if (v && typeof v === "object") {
    for (const [k, inner] of Object.entries(v)) requireStringMembrane(inner, `${ctx}.${k}`);
    return;
  }
  if (typeof v !== "string") die(`${ctx} violates string membrane`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "emit") out.mode = "emit";
    else if (a === "validate") out.mode = "validate";
    else if (a === "--seed" && argv[i + 1]) out.seed = argv[++i];
    else if (a === "--grammar" && argv[i + 1]) out.grammar = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--help" || a === "-h") out.help = "1";
    else die(`unknown arg: ${a}`);
  }
  return out;
}

async function readJson(p) {
  const raw = await fs.readFile(path.resolve(process.cwd(), p), "utf8");
  return JSON.parse(raw);
}

function validateGrammar(grammar) {
  keyset(grammar, ["authority", "digest", "emission_rules", "grammar_id", "roles", "states", "transitions", "v"], "dialogue_grammar");
  if (grammar.v !== VERSION) die("dialogue grammar version mismatch");
  if (grammar.authority !== "advisory") die("dialogue grammar authority must be advisory");
  requireSha(grammar.grammar_id, "grammar_id");
  requireSha(grammar.digest, "digest");

  if (!Array.isArray(grammar.roles) || grammar.roles.length === 0) die("roles must be non-empty array");
  const roleSet = new Set();
  for (const [i, roleId] of grammar.roles.entries()) {
    requireSha(roleId, `roles[${i}]`);
    roleSet.add(roleId);
  }

  if (!Array.isArray(grammar.states) || grammar.states.length === 0) die("states must be non-empty array");
  const stateSet = new Set();
  for (const [i, state] of grammar.states.entries()) {
    keyset(state, ["label", "role", "state_id"], `states[${i}]`);
    requireSha(state.state_id, `states[${i}].state_id`);
    requireSha(state.role, `states[${i}].role`);
    if (!roleSet.has(state.role)) die(`states[${i}] unresolved role`);
    if (stateSet.has(state.state_id)) die(`duplicate state_id: ${state.state_id}`);
    stateSet.add(state.state_id);
  }

  if (!Array.isArray(grammar.transitions)) die("transitions must be array");
  for (const [i, tr] of grammar.transitions.entries()) {
    keyset(tr, ["condition", "from_state", "to_state", "verb"], `transitions[${i}]`);
    requireSha(tr.from_state, `transitions[${i}].from_state`);
    requireSha(tr.to_state, `transitions[${i}].to_state`);
    if (!stateSet.has(tr.from_state) || !stateSet.has(tr.to_state)) die(`transitions[${i}] unresolved state`);
    if (!VERBS.has(tr.verb)) die(`transitions[${i}].verb unknown`);
    if (tr.condition !== "always") requireSha(tr.condition, `transitions[${i}].condition`);
  }

  if (!Array.isArray(grammar.emission_rules)) die("emission_rules must be array");
  for (const [i, r] of grammar.emission_rules.entries()) {
    keyset(r, ["allowed_artifact_types", "state_id"], `emission_rules[${i}]`);
    requireSha(r.state_id, `emission_rules[${i}].state_id`);
    if (!stateSet.has(r.state_id)) die(`emission_rules[${i}] unresolved state`);
    if (!Array.isArray(r.allowed_artifact_types) || r.allowed_artifact_types.length === 0) {
      die(`emission_rules[${i}].allowed_artifact_types must be non-empty array`);
    }
    r.allowed_artifact_types.forEach((t, idx) => {
      if (typeof t !== "string" || !ARTIFACT_TYPES.has(t)) die(`emission_rules[${i}].allowed_artifact_types[${idx}] invalid`);
    });
  }

  requireStringMembrane(grammar, "dialogue_grammar");

  const body = {
    authority: grammar.authority,
    emission_rules: grammar.emission_rules,
    grammar_id: grammar.grammar_id,
    roles: grammar.roles,
    states: grammar.states,
    transitions: grammar.transitions,
    v: grammar.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== grammar.digest) die("dialogue grammar digest mismatch");
}

function buildFromSeed(seed) {
  keyset(seed, ["authority", "emission_rules", "grammar_id", "roles", "states", "transitions"], "seed");
  const grammar = {
    authority: seed.authority,
    emission_rules: seed.emission_rules,
    grammar_id: seed.grammar_id,
    roles: seed.roles,
    states: seed.states,
    transitions: seed.transitions,
    v: VERSION,
  };
  const digest = shaPref(Buffer.from(canonicalJson(grammar), "utf8"));
  return { ...grammar, digest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-dialogue-grammar emit --seed <seed.json> --out <grammar.json>");
    console.log("mv-dialogue-grammar validate --grammar <grammar.json>");
    return;
  }

  if (args.mode === "emit") {
    if (!args.seed || !args.out) die("emit requires --seed --out");
    const seed = await readJson(args.seed);
    const grammar = buildFromSeed(seed);
    validateGrammar(grammar);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(grammar), "utf8");
    console.log(`ok mv-dialogue-grammar emit digest=${grammar.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.grammar) die("validate requires --grammar");
    const grammar = await readJson(args.grammar);
    validateGrammar(grammar);
    console.log(`ok mv-dialogue-grammar validate digest=${grammar.digest}`);
    return;
  }

  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
