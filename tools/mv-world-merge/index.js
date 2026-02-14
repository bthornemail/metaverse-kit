#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave21.world_merge.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const STRATEGIES = new Set(["lexicographic", "left_preferred", "right_preferred"]);
const RESOLUTIONS = new Set(["left", "right", "lexicographic"]);

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
  const out = { strategy: "lexicographic" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "emit") out.mode = "emit";
    else if (a === "validate") out.mode = "validate";
    else if (a === "--left" && argv[i + 1]) out.left = argv[++i];
    else if (a === "--right" && argv[i + 1]) out.right = argv[++i];
    else if (a === "--merge" && argv[i + 1]) out.merge = argv[++i];
    else if (a === "--strategy" && argv[i + 1]) out.strategy = argv[++i];
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

function validateRelation(rel, ctx) {
  keyset(rel, ["relation_id", "relation_type", "source_node", "stance", "target_node", "weight"], ctx);
  requireSha(rel.relation_id, `${ctx}.relation_id`);
  requireSha(rel.source_node, `${ctx}.source_node`);
  requireSha(rel.target_node, `${ctx}.target_node`);
}

function validateWorldGraph(world, ctx) {
  keyset(world, ["authority", "base_world_entities_digest", "digest", "relations", "summary", "v"], ctx);
  if (world.v !== "wave19.world_graph.v0") die(`${ctx} version mismatch`);
  if (world.authority !== "advisory") die(`${ctx} authority mismatch`);
  requireSha(world.base_world_entities_digest, `${ctx}.base_world_entities_digest`);
  requireSha(world.digest, `${ctx}.digest`);
  if (!Array.isArray(world.relations)) die(`${ctx}.relations must be array`);
  for (const [i, rel] of world.relations.entries()) validateRelation(rel, `${ctx}.relations[${i}]`);
  const sorted = [...world.relations].sort((a, b) => a.relation_id.localeCompare(b.relation_id));
  if (stableStringify(sorted) !== stableStringify(world.relations)) die(`${ctx}.relations must be sorted`);

  const body = {
    authority: world.authority,
    base_world_entities_digest: world.base_world_entities_digest,
    relations: world.relations,
    summary: world.summary,
    v: world.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== world.digest) die(`${ctx} digest mismatch`);
}

function chooseConflict(leftRel, rightRel, strategy) {
  if (strategy === "left_preferred") return { chosen: leftRel, resolution: "left" };
  if (strategy === "right_preferred") return { chosen: rightRel, resolution: "right" };
  const l = canonicalJson(leftRel);
  const r = canonicalJson(rightRel);
  return l <= r
    ? { chosen: leftRel, resolution: "lexicographic" }
    : { chosen: rightRel, resolution: "lexicographic" };
}

function mergeRelations(left, right, strategy) {
  const leftById = new Map(left.map((r) => [r.relation_id, r]));
  const rightById = new Map(right.map((r) => [r.relation_id, r]));
  const allIds = [...new Set([...leftById.keys(), ...rightById.keys()])].sort((a, b) => a.localeCompare(b));
  const relations = [];
  const conflicts = [];

  for (const id of allIds) {
    const l = leftById.get(id);
    const r = rightById.get(id);
    if (l && !r) {
      relations.push(l);
      continue;
    }
    if (!l && r) {
      relations.push(r);
      continue;
    }
    if (stableStringify(l) === stableStringify(r)) {
      relations.push(l);
      continue;
    }
    const { chosen, resolution } = chooseConflict(l, r, strategy);
    relations.push(chosen);
    conflicts.push({
      relation_id: id,
      left_digest: shaPref(Buffer.from(canonicalJson(l), "utf8")),
      right_digest: shaPref(Buffer.from(canonicalJson(r), "utf8")),
      resolution,
    });
  }

  return { relations, conflicts };
}

function buildSummary(left, right, merged, conflicts) {
  return {
    left_relation_count: String(left.length),
    right_relation_count: String(right.length),
    merged_relation_count: String(merged.length),
    conflict_count: String(conflicts.length),
  };
}

function validateSummary(summary, left, right, merged, conflicts) {
  keyset(summary, ["conflict_count", "left_relation_count", "merged_relation_count", "right_relation_count"], "summary");
  const want = buildSummary(left, right, merged, conflicts);
  if (stableStringify(summary) !== stableStringify(want)) die("summary mismatch");
}

function validateMerge(merge, left, right) {
  keyset(merge, ["authority", "conflicts", "digest", "left_world_graph_digest", "relations", "right_world_graph_digest", "strategy", "summary", "v"], "world_merge");
  if (merge.v !== VERSION) die("world_merge version mismatch");
  if (merge.authority !== "advisory") die("world_merge authority must be advisory");
  requireSha(merge.left_world_graph_digest, "left_world_graph_digest");
  requireSha(merge.right_world_graph_digest, "right_world_graph_digest");
  requireSha(merge.digest, "digest");
  if (!STRATEGIES.has(merge.strategy)) die("strategy invalid");
  if (!Array.isArray(merge.relations)) die("relations must be array");
  if (!Array.isArray(merge.conflicts)) die("conflicts must be array");

  for (const [i, rel] of merge.relations.entries()) validateRelation(rel, `relations[${i}]`);
  const sorted = [...merge.relations].sort((a, b) => a.relation_id.localeCompare(b.relation_id));
  if (stableStringify(sorted) !== stableStringify(merge.relations)) die("relations must be sorted");

  for (const [i, c] of merge.conflicts.entries()) {
    keyset(c, ["left_digest", "relation_id", "resolution", "right_digest"], `conflicts[${i}]`);
    requireSha(c.relation_id, `conflicts[${i}].relation_id`);
    requireSha(c.left_digest, `conflicts[${i}].left_digest`);
    requireSha(c.right_digest, `conflicts[${i}].right_digest`);
    if (!RESOLUTIONS.has(c.resolution)) die(`conflicts[${i}].resolution invalid`);
  }

  const recomputed = mergeRelations(left.relations, right.relations, merge.strategy);
  if (stableStringify(recomputed.relations) !== stableStringify(merge.relations)) die("merged relations mismatch");
  if (stableStringify(recomputed.conflicts) !== stableStringify(merge.conflicts)) die("conflicts mismatch");
  validateSummary(merge.summary, left.relations, right.relations, merge.relations, merge.conflicts);
  requireStringMembrane(merge, "world_merge");

  const body = {
    authority: merge.authority,
    conflicts: merge.conflicts,
    left_world_graph_digest: merge.left_world_graph_digest,
    relations: merge.relations,
    right_world_graph_digest: merge.right_world_graph_digest,
    strategy: merge.strategy,
    summary: merge.summary,
    v: merge.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== merge.digest) die("world_merge digest mismatch");
}

function buildMerge(left, right, strategy) {
  const { relations, conflicts } = mergeRelations(left.relations, right.relations, strategy);
  const summary = buildSummary(left.relations, right.relations, relations, conflicts);
  const body = {
    authority: "advisory",
    conflicts,
    left_world_graph_digest: left.digest,
    relations,
    right_world_graph_digest: right.digest,
    strategy,
    summary,
    v: VERSION,
  };
  const digest = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  return { ...body, digest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-world-merge emit --left <world_graph_a.json> --right <world_graph_b.json> [--strategy lexicographic] --out <world_merge.v0.json>");
    console.log("mv-world-merge validate --left <world_graph_a.json> --right <world_graph_b.json> --merge <world_merge.v0.json>");
    return;
  }

  if (!args.left || !args.right) die("--left and --right are required");
  if (!STRATEGIES.has(args.strategy)) die("strategy invalid");

  const left = await readJson(args.left);
  const right = await readJson(args.right);
  validateWorldGraph(left, "left_world_graph");
  validateWorldGraph(right, "right_world_graph");

  if (args.mode === "emit") {
    if (!args.out) die("emit requires --out");
    const merge = buildMerge(left, right, args.strategy);
    validateMerge(merge, left, right);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(merge), "utf8");
    console.log(`ok mv-world-merge emit digest=${merge.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.merge) die("validate requires --merge");
    const merge = await readJson(args.merge);
    validateMerge(merge, left, right);
    console.log(`ok mv-world-merge validate digest=${merge.digest}`);
    return;
  }

  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
