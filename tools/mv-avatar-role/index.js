#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave18.avatar_role.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const DOMAINS = new Set(["law", "wisdom", "cohesion", "covenant"]);
const VERBS = new Set(["OPEN_PASSAGE", "SET_STANCE", "SELECT_GENERATOR", "GENERATE_PROPOSAL"]);

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
    else if (a === "--role" && argv[i + 1]) out.role = argv[++i];
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

function validateRole(role) {
  keyset(role, [
    "allowed_verbs",
    "authority",
    "constraints",
    "digest",
    "dialogue_profile",
    "domain",
    "generator_permissions",
    "label",
    "role_id",
    "v",
  ], "avatar_role");

  if (role.v !== VERSION) die("avatar role version mismatch");
  if (role.authority !== "advisory") die("avatar role authority must be advisory");
  requireSha(role.role_id, "role_id");
  requireSha(role.digest, "digest");
  if (!DOMAINS.has(role.domain)) die("domain invalid");

  if (!Array.isArray(role.allowed_verbs)) die("allowed_verbs must be array");
  for (const [i, verb] of role.allowed_verbs.entries()) {
    if (typeof verb !== "string" || !VERBS.has(verb)) die(`allowed_verbs[${i}] unknown`);
  }

  if (!Array.isArray(role.generator_permissions)) die("generator_permissions must be array");
  role.generator_permissions.forEach((g, i) => {
    if (typeof g !== "string" || g.length === 0) die(`generator_permissions[${i}] invalid`);
  });

  keyset(role.dialogue_profile, ["priority", "requires_citation", "style"], "dialogue_profile");
  if (!["0", "1"].includes(role.dialogue_profile.requires_citation)) die("dialogue_profile.requires_citation must be 0|1");

  keyset(role.constraints, ["can_approve_merges", "can_emit_proposals", "can_override_constitution"], "constraints");
  for (const k of Object.keys(role.constraints)) {
    if (!["0", "1"].includes(role.constraints[k])) die(`constraints.${k} must be 0|1`);
  }

  requireStringMembrane(role, "avatar_role");

  const body = {
    allowed_verbs: role.allowed_verbs,
    authority: role.authority,
    constraints: role.constraints,
    dialogue_profile: role.dialogue_profile,
    domain: role.domain,
    generator_permissions: role.generator_permissions,
    label: role.label,
    role_id: role.role_id,
    v: role.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== role.digest) die("avatar role digest mismatch");
}

function buildFromSeed(seed) {
  keyset(seed, [
    "allowed_verbs",
    "authority",
    "constraints",
    "dialogue_profile",
    "domain",
    "generator_permissions",
    "label",
    "role_id",
  ], "seed");
  const role = {
    allowed_verbs: seed.allowed_verbs,
    authority: seed.authority,
    constraints: seed.constraints,
    dialogue_profile: seed.dialogue_profile,
    domain: seed.domain,
    generator_permissions: seed.generator_permissions,
    label: seed.label,
    role_id: seed.role_id,
    v: VERSION,
  };
  const digest = shaPref(Buffer.from(canonicalJson(role), "utf8"));
  return { ...role, digest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-avatar-role emit --seed <seed.json> --out <role.json>");
    console.log("mv-avatar-role validate --role <role.json>");
    return;
  }

  if (args.mode === "emit") {
    if (!args.seed || !args.out) die("emit requires --seed --out");
    const seed = await readJson(args.seed);
    const role = buildFromSeed(seed);
    validateRole(role);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(role), "utf8");
    console.log(`ok mv-avatar-role emit digest=${role.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.role) die("validate requires --role");
    const role = await readJson(args.role);
    validateRole(role);
    console.log(`ok mv-avatar-role validate digest=${role.digest}`);
    return;
  }

  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
