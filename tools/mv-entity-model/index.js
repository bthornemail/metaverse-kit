#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave19.entity_model.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const TYPES = new Set(["avatar", "object", "place", "process"]);
const ASSET_KINDS = new Set(["md", "json", "png", "gltf", "wav", "mp3", "bin"]);
const ASSET_ROLES = new Set(["visual", "audio", "logic", "doc", "data"]);
const EVENT_SOURCES = new Set(["interaction_tape", "shared_tape", "dialogue_grammar"]);
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
    else if (a === "--entity" && argv[i + 1]) out.entity = argv[++i];
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

function validateEntity(entity) {
  keyset(entity, ["assets", "authority", "behaviors", "digest", "entity_id", "ontology_role", "permissions", "state", "type", "v"], "entity_model");
  if (entity.v !== VERSION) die("entity model version mismatch");
  if (entity.authority !== "advisory") die("entity authority must be advisory");
  requireSha(entity.entity_id, "entity_id");
  requireSha(entity.digest, "digest");
  if (!TYPES.has(entity.type)) die("entity type invalid");
  if (typeof entity.ontology_role !== "string" || entity.ontology_role.length === 0) die("ontology_role invalid");

  if (!entity.state || typeof entity.state !== "object" || Array.isArray(entity.state)) die("state must be object");

  if (!Array.isArray(entity.assets)) die("assets must be array");
  for (const [i, asset] of entity.assets.entries()) {
    keyset(asset, ["digest", "kind", "role"], `assets[${i}]`);
    requireSha(asset.digest, `assets[${i}].digest`);
    if (!ASSET_KINDS.has(asset.kind)) die(`assets[${i}].kind invalid`);
    if (!ASSET_ROLES.has(asset.role)) die(`assets[${i}].role invalid`);
  }

  keyset(entity.behaviors, ["allowed_verbs", "event_source"], "behaviors");
  if (!EVENT_SOURCES.has(entity.behaviors.event_source)) die("behaviors.event_source invalid");
  if (!Array.isArray(entity.behaviors.allowed_verbs)) die("behaviors.allowed_verbs must be array");
  for (const [i, verb] of entity.behaviors.allowed_verbs.entries()) {
    if (typeof verb !== "string" || !VERBS.has(verb)) die(`behaviors.allowed_verbs[${i}] unknown`);
  }

  keyset(entity.permissions, ["can_emit_proposals", "can_mutate_canonical"], "permissions");
  for (const k of Object.keys(entity.permissions)) {
    if (!["0", "1"].includes(entity.permissions[k])) die(`permissions.${k} must be 0|1`);
  }
  if (entity.permissions.can_mutate_canonical !== "0") die("permissions.can_mutate_canonical must be 0");

  requireStringMembrane(entity, "entity_model");

  const body = {
    assets: entity.assets,
    authority: entity.authority,
    behaviors: entity.behaviors,
    entity_id: entity.entity_id,
    ontology_role: entity.ontology_role,
    permissions: entity.permissions,
    state: entity.state,
    type: entity.type,
    v: entity.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== entity.digest) die("entity digest mismatch");
}

function buildFromSeed(seed) {
  keyset(seed, ["assets", "authority", "behaviors", "entity_id", "ontology_role", "permissions", "state", "type"], "seed");
  const entity = {
    assets: seed.assets,
    authority: seed.authority,
    behaviors: seed.behaviors,
    entity_id: seed.entity_id,
    ontology_role: seed.ontology_role,
    permissions: seed.permissions,
    state: seed.state,
    type: seed.type,
    v: VERSION,
  };
  const digest = shaPref(Buffer.from(canonicalJson(entity), "utf8"));
  return { ...entity, digest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-entity-model emit --seed <seed.json> --out <entity.json>");
    console.log("mv-entity-model validate --entity <entity.json>");
    return;
  }

  if (args.mode === "emit") {
    if (!args.seed || !args.out) die("emit requires --seed --out");
    const seed = await readJson(args.seed);
    const entity = buildFromSeed(seed);
    validateEntity(entity);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(entity), "utf8");
    console.log(`ok mv-entity-model emit digest=${entity.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.entity) die("validate requires --entity");
    const entity = await readJson(args.entity);
    validateEntity(entity);
    console.log(`ok mv-entity-model validate digest=${entity.digest}`);
    return;
  }

  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
