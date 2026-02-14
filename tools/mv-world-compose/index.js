#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave19.world_entities.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const LAYERS = new Set(["forum", "timeline", "inspector", "vr"]);

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { entities: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "emit") out.mode = "emit";
    else if (a === "validate") out.mode = "validate";
    else if (a === "--seed" && argv[i + 1]) out.seed = argv[++i];
    else if (a === "--world" && argv[i + 1]) out.world = argv[++i];
    else if (a === "--entity" && argv[i + 1]) out.entities.push(argv[++i]);
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

async function readJson(p) {
  const raw = await fs.readFile(path.resolve(process.cwd(), p), "utf8");
  return JSON.parse(raw);
}

async function loadEntities(paths) {
  if (paths.length === 0) die("at least one --entity is required");
  const ids = new Set();
  for (const p of paths) {
    const e = await readJson(p);
    if (!e || typeof e !== "object" || Array.isArray(e)) die(`entity artifact invalid: ${p}`);
    if (e.v !== "wave19.entity_model.v0") die(`entity artifact version mismatch: ${p}`);
    requireSha(e.entity_id, `entity ${p} entity_id`);
    ids.add(e.entity_id);
  }
  return ids;
}

function buildSummary(rows) {
  const unique = new Set(rows.map((r) => r.entity_digest));
  return {
    entity_count: String(rows.length),
    unique_entity_digest_count: String(unique.size),
  };
}

function validateRows(rows, knownEntityIds) {
  if (!Array.isArray(rows)) die("entities must be array");
  const nodeIds = new Set();
  for (const [i, row] of rows.entries()) {
    keyset(row, ["entity_digest", "node_id", "scene_layer", "x", "y", "z"], `entities[${i}]`);
    requireSha(row.entity_digest, `entities[${i}].entity_digest`);
    requireSha(row.node_id, `entities[${i}].node_id`);
    if (!LAYERS.has(row.scene_layer)) die(`entities[${i}].scene_layer invalid`);
    if (!/^[-]?[0-9]+$/.test(row.x) || !/^[-]?[0-9]+$/.test(row.y) || !/^[-]?[0-9]+$/.test(row.z)) {
      die(`entities[${i}] coordinates must be decimal strings`);
    }
    if (nodeIds.has(row.node_id)) die(`duplicate node_id: ${row.node_id}`);
    if (!knownEntityIds.has(row.entity_digest)) die(`entities[${i}] unresolved entity_digest`);
    nodeIds.add(row.node_id);
  }
}

function validateWorld(world, knownEntityIds) {
  keyset(world, ["authority", "base_bundle_digest", "digest", "entities", "summary", "v"], "world_entities");
  if (world.v !== VERSION) die("world_entities version mismatch");
  if (world.authority !== "advisory") die("world_entities authority must be advisory");
  requireSha(world.base_bundle_digest, "base_bundle_digest");
  requireSha(world.digest, "digest");
  validateRows(world.entities, knownEntityIds);
  keyset(world.summary, ["entity_count", "unique_entity_digest_count"], "summary");
  const expected = buildSummary(world.entities);
  if (stableStringify(world.summary) !== stableStringify(expected)) die("summary mismatch");
  requireStringMembrane(world, "world_entities");

  const body = {
    authority: world.authority,
    base_bundle_digest: world.base_bundle_digest,
    entities: [...world.entities].sort((a, b) => a.node_id.localeCompare(b.node_id)),
    summary: world.summary,
    v: world.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== world.digest) die("world_entities digest mismatch");
}

function buildWorld(seed, knownEntityIds) {
  keyset(seed, ["base_bundle_digest", "entities"], "seed");
  requireSha(seed.base_bundle_digest, "seed.base_bundle_digest");
  validateRows(seed.entities, knownEntityIds);
  const entities = [...seed.entities].sort((a, b) => a.node_id.localeCompare(b.node_id));
  const summary = buildSummary(entities);
  const body = {
    authority: "advisory",
    base_bundle_digest: seed.base_bundle_digest,
    entities,
    summary,
    v: VERSION,
  };
  const digest = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  return { ...body, digest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-world-compose emit --seed <seed.json> --entity <entity.v0.json> [--entity <...>] --out <world_entities.v0.json>");
    console.log("mv-world-compose validate --world <world_entities.v0.json> --entity <entity.v0.json> [--entity <...>]");
    return;
  }

  if (args.mode === "emit") {
    if (!args.seed || !args.out) die("emit requires --seed --out");
    const knownEntityIds = await loadEntities(args.entities);
    const seed = await readJson(args.seed);
    const world = buildWorld(seed, knownEntityIds);
    validateWorld(world, knownEntityIds);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(world), "utf8");
    console.log(`ok mv-world-compose emit digest=${world.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.world) die("validate requires --world");
    const knownEntityIds = await loadEntities(args.entities);
    const world = await readJson(args.world);
    validateWorld(world, knownEntityIds);
    console.log(`ok mv-world-compose validate digest=${world.digest}`);
    return;
  }

  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
