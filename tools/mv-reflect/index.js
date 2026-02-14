#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave22.reflection_result.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const OPS = ["swap_endpoints", "swap_solon_solomon", "swap_asabiyyah_metatron"];
const STANCES = new Set(["neutral", "solon", "solomon", "asabiyyah", "metatron"]);

function die(msg) { console.error(`ERROR: ${msg}`); process.exit(2); }
function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const ks = Object.keys(v).sort();
    return `{${ks.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
function canonicalJson(o) { return `${stableStringify(o)}\n`; }
function shaPref(bytes) { return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function keyset(o, expected, ctx) {
  const got = Object.keys(o).sort().join(",");
  const want = [...expected].sort().join(",");
  if (got !== want) die(`${ctx} keyset mismatch`);
}
function requireSha(v, ctx) { if (typeof v !== "string" || !SHA_RE.test(v)) die(`${ctx} invalid sha256`); }
function requireMem(v, ctx) {
  if (Array.isArray(v)) { v.forEach((x, i) => requireMem(x, `${ctx}[${i}]`)); return; }
  if (v && typeof v === "object") { for (const [k, x] of Object.entries(v)) requireMem(x, `${ctx}.${k}`); return; }
  if (typeof v !== "string") die(`${ctx} violates string membrane`);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "emit") out.mode = "emit";
    else if (a === "validate") out.mode = "validate";
    else if (a === "apply") out.mode = "apply";
    else if (a === "--world-graph" && argv[i + 1]) out.worldGraph = argv[++i];
    else if (a === "--reflection" && argv[i + 1]) out.reflection = argv[++i];
    else if (a === "--operator" && argv[i + 1]) out.operator = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--out-world-graph" && argv[i + 1]) out.outGraph = argv[++i];
    else if (a === "--help" || a === "-h") out.help = "1";
    else die(`unknown arg: ${a}`);
  }
  return out;
}
async function readJson(p) { return JSON.parse(await fs.readFile(path.resolve(process.cwd(), p), "utf8")); }

function validateRelation(r, ctx) {
  keyset(r, ["relation_id", "relation_type", "source_node", "stance", "target_node", "weight"], ctx);
  requireSha(r.relation_id, `${ctx}.relation_id`);
  requireSha(r.source_node, `${ctx}.source_node`);
  requireSha(r.target_node, `${ctx}.target_node`);
  if (!STANCES.has(r.stance)) die(`${ctx}.stance invalid`);
}
function validateSummary(summary, relations) {
  keyset(summary, ["relation_count", "unique_node_count"], "summary");
  const nodes = new Set();
  for (const r of relations) { nodes.add(r.source_node); nodes.add(r.target_node); }
  const want = { relation_count: String(relations.length), unique_node_count: String(nodes.size) };
  if (stableStringify(summary) !== stableStringify(want)) die("summary mismatch");
}
function validateWorldGraph(g, ctx) {
  keyset(g, ["authority", "base_world_entities_digest", "digest", "relations", "summary", "v"], ctx);
  if (g.v !== "wave19.world_graph.v0") die(`${ctx} version mismatch`);
  if (g.authority !== "advisory") die(`${ctx} authority must be advisory`);
  requireSha(g.base_world_entities_digest, `${ctx}.base_world_entities_digest`);
  requireSha(g.digest, `${ctx}.digest`);
  if (!Array.isArray(g.relations)) die(`${ctx}.relations must be array`);
  g.relations.forEach((r, i) => validateRelation(r, `${ctx}.relations[${i}]`));
  const sorted = [...g.relations].sort((a, b) => a.relation_id.localeCompare(b.relation_id));
  if (stableStringify(sorted) !== stableStringify(g.relations)) die(`${ctx}.relations must be sorted by relation_id`);
  validateSummary(g.summary, g.relations);
  requireMem(g, ctx);
  const body = {
    authority: g.authority,
    base_world_entities_digest: g.base_world_entities_digest,
    relations: g.relations,
    summary: g.summary,
    v: g.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== g.digest) die(`${ctx} digest mismatch`);
}
function reflectStance(stance, op) {
  if (op === "swap_solon_solomon") {
    if (stance === "solon") return "solomon";
    if (stance === "solomon") return "solon";
  }
  if (op === "swap_asabiyyah_metatron") {
    if (stance === "asabiyyah") return "metatron";
    if (stance === "metatron") return "asabiyyah";
  }
  return stance;
}
function applyOperator(worldGraph, operator) {
  if (!OPS.includes(operator)) die("reflection_operator_id invalid");
  const relations = worldGraph.relations.map((r) => {
    const next = { ...r };
    if (operator === "swap_endpoints") {
      next.source_node = r.target_node;
      next.target_node = r.source_node;
    }
    next.stance = reflectStance(next.stance, operator);
    return next;
  }).sort((a, b) => a.relation_id.localeCompare(b.relation_id));
  const nodes = new Set();
  for (const r of relations) { nodes.add(r.source_node); nodes.add(r.target_node); }
  const summary = { relation_count: String(relations.length), unique_node_count: String(nodes.size) };
  const body = {
    authority: "advisory",
    base_world_entities_digest: worldGraph.base_world_entities_digest,
    relations,
    summary,
    v: "wave19.world_graph.v0",
  };
  return { ...body, digest: shaPref(Buffer.from(canonicalJson(body), "utf8")) };
}
function operatorSetDigest() {
  return shaPref(Buffer.from(canonicalJson({ operators: OPS }), "utf8"));
}
function buildResult(sourceGraph, operator) {
  const reflected = applyOperator(sourceGraph, operator);
  const reflectedTwice = applyOperator(reflected, operator);
  const involutive = reflectedTwice.digest === sourceGraph.digest ? "1" : "0";
  if (involutive !== "1") die("reflection failed involution check");
  const body = {
    authority: "advisory",
    operator_set_digest: operatorSetDigest(),
    proof_of_involution: involutive,
    reflection_operator_id: operator,
    result_digest: reflected.digest,
    source_digest: sourceGraph.digest,
    v: VERSION,
  };
  return { reflected, result: { ...body, digest: shaPref(Buffer.from(canonicalJson(body), "utf8")) } };
}
function validateResult(result, sourceGraph) {
  keyset(result, ["authority", "digest", "operator_set_digest", "proof_of_involution", "reflection_operator_id", "result_digest", "source_digest", "v"], "reflection_result");
  if (result.v !== VERSION) die("reflection_result version mismatch");
  if (result.authority !== "advisory") die("reflection_result authority must be advisory");
  if (!OPS.includes(result.reflection_operator_id)) die("reflection_operator_id invalid");
  requireSha(result.operator_set_digest, "operator_set_digest");
  requireSha(result.source_digest, "source_digest");
  requireSha(result.result_digest, "result_digest");
  requireSha(result.digest, "digest");
  if (result.operator_set_digest !== operatorSetDigest()) die("operator_set_digest mismatch");
  if (result.source_digest !== sourceGraph.digest) die("source_digest mismatch");
  const { reflected } = buildResult(sourceGraph, result.reflection_operator_id);
  if (result.result_digest !== reflected.digest) die("result_digest mismatch");
  if (result.proof_of_involution !== "1") die("proof_of_involution must be 1");
  requireMem(result, "reflection_result");
  const body = {
    authority: result.authority,
    operator_set_digest: result.operator_set_digest,
    proof_of_involution: result.proof_of_involution,
    reflection_operator_id: result.reflection_operator_id,
    result_digest: result.result_digest,
    source_digest: result.source_digest,
    v: result.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== result.digest) die("reflection_result digest mismatch");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-reflect apply --world-graph <world_graph.v0.json> --operator <op> --out-world-graph <reflected_world_graph.v0.json>");
    console.log("mv-reflect emit --world-graph <world_graph.v0.json> --operator <op> --out <reflection_result.v0.json> [--out-world-graph <...>]");
    console.log("mv-reflect validate --world-graph <world_graph.v0.json> --reflection <reflection_result.v0.json>");
    return;
  }
  if (!args.worldGraph) die("--world-graph is required");
  const source = await readJson(args.worldGraph);
  validateWorldGraph(source, "world_graph");

  if (args.mode === "apply") {
    if (!args.operator || !args.outGraph) die("apply requires --operator --out-world-graph");
    const reflected = applyOperator(source, args.operator);
    validateWorldGraph(reflected, "reflected_world_graph");
    await fs.writeFile(path.resolve(process.cwd(), args.outGraph), canonicalJson(reflected), "utf8");
    console.log(`ok mv-reflect apply digest=${reflected.digest}`);
    return;
  }

  if (args.mode === "emit") {
    if (!args.operator || !args.out) die("emit requires --operator --out");
    const { reflected, result } = buildResult(source, args.operator);
    validateWorldGraph(reflected, "reflected_world_graph");
    validateResult(result, source);
    if (args.outGraph) {
      await fs.writeFile(path.resolve(process.cwd(), args.outGraph), canonicalJson(reflected), "utf8");
    }
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(result), "utf8");
    console.log(`ok mv-reflect emit digest=${result.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.reflection) die("validate requires --reflection");
    const result = await readJson(args.reflection);
    validateResult(result, source);
    console.log(`ok mv-reflect validate digest=${result.digest}`);
    return;
  }

  die("mode must be apply|emit|validate");
}

main().catch((err) => die(err.message || String(err)));
