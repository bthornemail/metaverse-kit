#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave20.behavior_grammar.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const VERBS = new Set(["RELATE", "UNRELATE", "FOCUS_CLUSTER", "TRACE_LINEAGE"]);
const CONDITIONS = new Set(["always", "same_stance", "adjacent_only"]);
const EFFECTS = new Set(["highlight", "trace", "cluster", "propose_relation", "propose_unrelation"]);
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
    else if (a === "--world-graph" && argv[i + 1]) out.worldGraph = argv[++i];
    else if (a === "--behavior-grammar" && argv[i + 1]) out.grammar = argv[++i];
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

function getWorldNodes(worldGraph) {
  if (!worldGraph || typeof worldGraph !== "object" || Array.isArray(worldGraph)) die("world_graph invalid");
  if (worldGraph.v !== "wave19.world_graph.v0") die("world_graph version mismatch");
  if (!Array.isArray(worldGraph.relations)) die("world_graph.relations missing");
  const nodes = new Set();
  for (const rel of worldGraph.relations) {
    if (!rel || typeof rel !== "object" || Array.isArray(rel)) die("world_graph relation invalid");
    if (typeof rel.source_node !== "string" || typeof rel.target_node !== "string") die("world_graph relation missing nodes");
    nodes.add(rel.source_node);
    nodes.add(rel.target_node);
  }
  return { nodes, digest: worldGraph.digest };
}

function validateRules(rules, nodeSet) {
  if (!Array.isArray(rules)) die("rules must be array");
  const ids = new Set();
  for (const [i, r] of rules.entries()) {
    keyset(r, ["condition", "effect", "rule_id", "source_node", "stance", "target_node", "verb"], `rules[${i}]`);
    requireSha(r.rule_id, `rules[${i}].rule_id`);
    requireSha(r.source_node, `rules[${i}].source_node`);
    requireSha(r.target_node, `rules[${i}].target_node`);
    if (!nodeSet.has(r.source_node)) die(`rules[${i}] unresolved source_node`);
    if (!nodeSet.has(r.target_node)) die(`rules[${i}] unresolved target_node`);
    if (!VERBS.has(r.verb)) die(`rules[${i}].verb invalid`);
    if (!CONDITIONS.has(r.condition)) die(`rules[${i}].condition invalid`);
    if (!EFFECTS.has(r.effect)) die(`rules[${i}].effect invalid`);
    if (!STANCES.has(r.stance)) die(`rules[${i}].stance invalid`);
    if (ids.has(r.rule_id)) die(`duplicate rule_id: ${r.rule_id}`);
    ids.add(r.rule_id);
  }
}

function buildSummary(rules) {
  const nodes = new Set();
  for (const r of rules) {
    nodes.add(r.source_node);
    nodes.add(r.target_node);
  }
  return {
    rule_count: String(rules.length),
    unique_node_count: String(nodes.size),
  };
}

function validateSummary(summary, rules) {
  keyset(summary, ["rule_count", "unique_node_count"], "summary");
  const want = buildSummary(rules);
  if (stableStringify(summary) !== stableStringify(want)) die("summary mismatch");
}

function validateGrammar(grammar, nodeSet) {
  keyset(grammar, ["authority", "base_world_graph_digest", "digest", "rules", "summary", "v"], "behavior_grammar");
  if (grammar.v !== VERSION) die("behavior_grammar version mismatch");
  if (grammar.authority !== "advisory") die("behavior_grammar authority must be advisory");
  requireSha(grammar.base_world_graph_digest, "base_world_graph_digest");
  requireSha(grammar.digest, "digest");
  validateRules(grammar.rules, nodeSet);
  validateSummary(grammar.summary, grammar.rules);
  requireStringMembrane(grammar, "behavior_grammar");

  const sorted = [...grammar.rules].sort((a, b) => a.rule_id.localeCompare(b.rule_id));
  if (stableStringify(sorted) !== stableStringify(grammar.rules)) die("rules must be sorted by rule_id");

  const body = {
    authority: grammar.authority,
    base_world_graph_digest: grammar.base_world_graph_digest,
    rules: grammar.rules,
    summary: grammar.summary,
    v: grammar.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== grammar.digest) die("behavior_grammar digest mismatch");
}

function buildGrammar(seed, worldGraphDigest, nodeSet) {
  keyset(seed, ["rules"], "seed");
  validateRules(seed.rules, nodeSet);
  const rules = [...seed.rules].sort((a, b) => a.rule_id.localeCompare(b.rule_id));
  const summary = buildSummary(rules);
  const body = {
    authority: "advisory",
    base_world_graph_digest: worldGraphDigest,
    rules,
    summary,
    v: VERSION,
  };
  const digest = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  return { ...body, digest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-behavior-grammar emit --seed <seed.json> --world-graph <world_graph.v0.json> --out <behavior_grammar.v0.json>");
    console.log("mv-behavior-grammar validate --behavior-grammar <behavior_grammar.v0.json> --world-graph <world_graph.v0.json>");
    return;
  }

  if (!args.worldGraph) die("--world-graph is required");
  const worldGraph = await readJson(args.worldGraph);
  const { nodes, digest } = getWorldNodes(worldGraph);

  if (args.mode === "emit") {
    if (!args.seed || !args.out) die("emit requires --seed --out");
    const seed = await readJson(args.seed);
    const grammar = buildGrammar(seed, digest, nodes);
    validateGrammar(grammar, nodes);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(grammar), "utf8");
    console.log(`ok mv-behavior-grammar emit digest=${grammar.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.grammar) die("validate requires --behavior-grammar");
    const grammar = await readJson(args.grammar);
    if (grammar.base_world_graph_digest !== digest) die("base_world_graph_digest mismatch");
    validateGrammar(grammar, nodes);
    console.log(`ok mv-behavior-grammar validate digest=${grammar.digest}`);
    return;
  }

  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
