#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave19.world_graph.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const REL_TYPES = new Set(["influences", "contains", "observes", "delegates", "adjacent_to", "mirrors"]);
const STANCES = new Set(["neutral", "solon", "solomon", "asabiyyah", "metatron"]);

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
    else if (a === "--world-entities" && argv[i + 1]) out.worldEntities = argv[++i];
    else if (a === "--world-graph" && argv[i + 1]) out.worldGraph = argv[++i];
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

function getWorldNodes(worldEntities) {
  if (!worldEntities || typeof worldEntities !== "object" || Array.isArray(worldEntities)) die("world_entities invalid");
  if (worldEntities.v !== "wave19.world_entities.v0") die("world_entities version mismatch");
  if (!Array.isArray(worldEntities.entities)) die("world_entities.entities missing");
  const nodes = new Set();
  for (const [i, row] of worldEntities.entities.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) die(`world_entities.entities[${i}] invalid`);
    if (typeof row.node_id !== "string") die(`world_entities.entities[${i}].node_id missing`);
    nodes.add(row.node_id);
  }
  return { nodes, digest: worldEntities.digest };
}

function validateRelations(relations, nodeSet) {
  if (!Array.isArray(relations)) die("relations must be array");
  const seen = new Set();
  for (const [i, rel] of relations.entries()) {
    keyset(rel, ["relation_id", "relation_type", "source_node", "stance", "target_node", "weight"], `relations[${i}]`);
    requireSha(rel.relation_id, `relations[${i}].relation_id`);
    requireSha(rel.source_node, `relations[${i}].source_node`);
    requireSha(rel.target_node, `relations[${i}].target_node`);
    if (!nodeSet.has(rel.source_node)) die(`relations[${i}] unresolved source_node`);
    if (!nodeSet.has(rel.target_node)) die(`relations[${i}] unresolved target_node`);
    if (!REL_TYPES.has(rel.relation_type)) die(`relations[${i}].relation_type invalid`);
    if (!STANCES.has(rel.stance)) die(`relations[${i}].stance invalid`);
    if (!/^-?[0-9]+$/.test(rel.weight)) die(`relations[${i}].weight invalid`);
    if (seen.has(rel.relation_id)) die(`duplicate relation_id: ${rel.relation_id}`);
    seen.add(rel.relation_id);
  }
}

function buildSummary(relations) {
  const nodes = new Set();
  for (const rel of relations) {
    nodes.add(rel.source_node);
    nodes.add(rel.target_node);
  }
  return {
    relation_count: String(relations.length),
    unique_node_count: String(nodes.size),
  };
}

function validateSummary(summary, relations) {
  keyset(summary, ["relation_count", "unique_node_count"], "summary");
  const want = buildSummary(relations);
  if (stableStringify(summary) !== stableStringify(want)) die("summary mismatch");
}

function validateWorldGraph(graph, nodeSet) {
  keyset(graph, ["authority", "base_world_entities_digest", "digest", "relations", "summary", "v"], "world_graph");
  if (graph.v !== VERSION) die("world_graph version mismatch");
  if (graph.authority !== "advisory") die("world_graph authority must be advisory");
  requireSha(graph.base_world_entities_digest, "base_world_entities_digest");
  requireSha(graph.digest, "digest");
  validateRelations(graph.relations, nodeSet);
  validateSummary(graph.summary, graph.relations);
  requireStringMembrane(graph, "world_graph");

  const sorted = [...graph.relations].sort((a, b) => a.relation_id.localeCompare(b.relation_id));
  if (stableStringify(sorted) !== stableStringify(graph.relations)) die("relations must be sorted by relation_id");

  const body = {
    authority: graph.authority,
    base_world_entities_digest: graph.base_world_entities_digest,
    relations: graph.relations,
    summary: graph.summary,
    v: graph.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== graph.digest) die("world_graph digest mismatch");
}

function buildWorldGraph(seed, worldEntitiesDigest, nodeSet) {
  keyset(seed, ["relations"], "seed");
  validateRelations(seed.relations, nodeSet);
  const relations = [...seed.relations].sort((a, b) => a.relation_id.localeCompare(b.relation_id));
  const summary = buildSummary(relations);
  const body = {
    authority: "advisory",
    base_world_entities_digest: worldEntitiesDigest,
    relations,
    summary,
    v: VERSION,
  };
  const digest = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  return { ...body, digest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-world-graph emit --seed <seed.json> --world-entities <world_entities.v0.json> --out <world_graph.v0.json>");
    console.log("mv-world-graph validate --world-graph <world_graph.v0.json> --world-entities <world_entities.v0.json>");
    return;
  }

  if (!args.worldEntities) die("--world-entities is required");
  const worldEntities = await readJson(args.worldEntities);
  const { nodes, digest } = getWorldNodes(worldEntities);

  if (args.mode === "emit") {
    if (!args.seed || !args.out) die("emit requires --seed --out");
    const seed = await readJson(args.seed);
    const graph = buildWorldGraph(seed, digest, nodes);
    validateWorldGraph(graph, nodes);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(graph), "utf8");
    console.log(`ok mv-world-graph emit digest=${graph.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.worldGraph) die("validate requires --world-graph");
    const graph = await readJson(args.worldGraph);
    if (graph.base_world_entities_digest !== digest) die("base_world_entities_digest mismatch");
    validateWorldGraph(graph, nodes);
    console.log(`ok mv-world-graph validate digest=${graph.digest}`);
    return;
  }

  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
