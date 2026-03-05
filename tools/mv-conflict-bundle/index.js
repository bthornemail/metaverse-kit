#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave17.conflict_bundle.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const RESOLUTION_STRATEGIES = new Set(["manual_review", "prefer_left", "prefer_right"]);
const RESOLUTION_STATUSES = new Set(["proposed", "accepted", "rejected"]);
const FORBIDDEN_AUTHORITY_KEYS = new Set(["apply", "commit", "final", "merge_applied", "truth", "world", "world_state"]);

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

function requireString(v, ctx) {
  if (typeof v !== "string" || v.length === 0) die(`${ctx} must be non-empty string`);
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

function assertAdvisoryOnlyShape(v, ctx) {
  if (Array.isArray(v)) {
    v.forEach((item, i) => assertAdvisoryOnlyShape(item, `${ctx}[${i}]`));
    return;
  }
  if (!v || typeof v !== "object") return;

  for (const [k, inner] of Object.entries(v)) {
    if (FORBIDDEN_AUTHORITY_KEYS.has(k)) {
      die(`conflict_bundle is advisory-only; forbidden field: ${ctx}.${k}`);
    }
    assertAdvisoryOnlyShape(inner, `${ctx}.${k}`);
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "emit") out.mode = "emit";
    else if (a === "validate") out.mode = "validate";
    else if (a === "--left-world" && argv[i + 1]) out.leftWorld = argv[++i];
    else if (a === "--right-world" && argv[i + 1]) out.rightWorld = argv[++i];
    else if (a === "--left-world-digest" && argv[i + 1]) out.leftDigest = argv[++i];
    else if (a === "--right-world-digest" && argv[i + 1]) out.rightDigest = argv[++i];
    else if (a === "--strategy" && argv[i + 1]) out.strategy = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--out-trace" && argv[i + 1]) out.outTrace = argv[++i];
    else if (a === "--conflict-bundle" && argv[i + 1]) out.conflictBundle = argv[++i];
    else if (a === "--help" || a === "-h") out.help = "1";
    else die(`unknown arg: ${a}`);
  }
  return out;
}

async function readJson(p) {
  const raw = await fs.readFile(path.resolve(process.cwd(), p), "utf8");
  return JSON.parse(raw);
}

async function writeCanonicalJson(p, obj) {
  await fs.writeFile(path.resolve(process.cwd(), p), canonicalJson(obj), "utf8");
}

function validateWorld(world, ctx) {
  keyset(world, ["edges", "nodes"], ctx);
  if (!Array.isArray(world.nodes)) die(`${ctx}.nodes must be array`);
  if (!Array.isArray(world.edges)) die(`${ctx}.edges must be array`);

  const nodeIds = new Set();
  for (const [i, n] of world.nodes.entries()) {
    keyset(n, ["id", "kind", "value"], `${ctx}.nodes[${i}]`);
    requireString(n.id, `${ctx}.nodes[${i}].id`);
    requireString(n.kind, `${ctx}.nodes[${i}].kind`);
    requireString(n.value, `${ctx}.nodes[${i}].value`);
    if (nodeIds.has(n.id)) die(`${ctx}.nodes duplicate id: ${n.id}`);
    nodeIds.add(n.id);
  }

  const edgeIds = new Set();
  for (const [i, e] of world.edges.entries()) {
    keyset(e, ["direction", "from", "id", "label", "to"], `${ctx}.edges[${i}]`);
    requireString(e.id, `${ctx}.edges[${i}].id`);
    requireString(e.from, `${ctx}.edges[${i}].from`);
    requireString(e.to, `${ctx}.edges[${i}].to`);
    requireString(e.label, `${ctx}.edges[${i}].label`);
    requireString(e.direction, `${ctx}.edges[${i}].direction`);
    if (edgeIds.has(e.id)) die(`${ctx}.edges duplicate id: ${e.id}`);
    edgeIds.add(e.id);
  }

  requireStringMembrane(world, ctx);
}

function worldDigest(world) {
  return shaPref(Buffer.from(canonicalJson(world), "utf8"));
}

function sortById(a, b) {
  return a.id.localeCompare(b.id);
}

function diffNodes(leftNodes, rightNodes) {
  const left = new Map(leftNodes.map((n) => [n.id, n]));
  const right = new Map(rightNodes.map((n) => [n.id, n]));
  const allIds = [...new Set([...left.keys(), ...right.keys()])].sort();

  const added = [];
  const removed = [];
  const changed = [];
  for (const id of allIds) {
    const l = left.get(id);
    const r = right.get(id);
    if (!l && r) {
      added.push({ id: r.id, kind: r.kind, value: r.value });
      continue;
    }
    if (l && !r) {
      removed.push({ id: l.id, kind: l.kind, value: l.value });
      continue;
    }
    if (stableStringify(l) !== stableStringify(r)) {
      changed.push({
        id,
        left_kind: l.kind,
        left_value: l.value,
        right_kind: r.kind,
        right_value: r.value,
        status: "conflict",
      });
    }
  }
  return { added: added.sort(sortById), removed: removed.sort(sortById), changed: changed.sort(sortById) };
}

function diffEdges(leftEdges, rightEdges) {
  const left = new Map(leftEdges.map((e) => [e.id, e]));
  const right = new Map(rightEdges.map((e) => [e.id, e]));
  const allIds = [...new Set([...left.keys(), ...right.keys()])].sort();

  const added = [];
  const removed = [];
  const changed = [];
  for (const id of allIds) {
    const l = left.get(id);
    const r = right.get(id);
    if (!l && r) {
      added.push({ id: r.id, from: r.from, to: r.to, label: r.label, direction: r.direction });
      continue;
    }
    if (l && !r) {
      removed.push({ id: l.id, from: l.from, to: l.to, label: l.label, direction: l.direction });
      continue;
    }
    if (stableStringify(l) !== stableStringify(r)) {
      changed.push({
        id,
        left_from: l.from,
        left_to: l.to,
        left_label: l.label,
        left_direction: l.direction,
        right_from: r.from,
        right_to: r.to,
        right_label: r.label,
        right_direction: r.direction,
        status: "conflict",
      });
    }
  }
  return { added: added.sort(sortById), removed: removed.sort(sortById), changed: changed.sort(sortById) };
}

function buildSummary(nodeDiffs, edgeDiffs) {
  const conflictCount = nodeDiffs.changed.length + edgeDiffs.changed.length;
  return {
    conflict_count: String(conflictCount),
    edge_added: String(edgeDiffs.added.length),
    edge_changed: String(edgeDiffs.changed.length),
    edge_removed: String(edgeDiffs.removed.length),
    node_added: String(nodeDiffs.added.length),
    node_changed: String(nodeDiffs.changed.length),
    node_removed: String(nodeDiffs.removed.length),
  };
}

function buildResolution(strategy) {
  if (!RESOLUTION_STRATEGIES.has(strategy)) die(`strategy invalid: ${strategy}`);
  return {
    note: "proposal-only; no canonical mutation",
    proposal_id: shaPref(Buffer.from(`conflict-bundle:${strategy}`, "utf8")),
    status: "proposed",
    strategy,
  };
}

function validateNodeDiffs(nodeDiffs) {
  keyset(nodeDiffs, ["added", "changed", "removed"], "node_diffs");
  if (!Array.isArray(nodeDiffs.added) || !Array.isArray(nodeDiffs.removed) || !Array.isArray(nodeDiffs.changed)) {
    die("node_diffs arrays required");
  }
  for (const [i, n] of nodeDiffs.added.entries()) {
    keyset(n, ["id", "kind", "value"], `node_diffs.added[${i}]`);
    requireString(n.id, `node_diffs.added[${i}].id`);
    requireString(n.kind, `node_diffs.added[${i}].kind`);
    requireString(n.value, `node_diffs.added[${i}].value`);
  }
  for (const [i, n] of nodeDiffs.removed.entries()) {
    keyset(n, ["id", "kind", "value"], `node_diffs.removed[${i}]`);
    requireString(n.id, `node_diffs.removed[${i}].id`);
    requireString(n.kind, `node_diffs.removed[${i}].kind`);
    requireString(n.value, `node_diffs.removed[${i}].value`);
  }
  for (const [i, n] of nodeDiffs.changed.entries()) {
    keyset(n, ["id", "left_kind", "left_value", "right_kind", "right_value", "status"], `node_diffs.changed[${i}]`);
    requireString(n.id, `node_diffs.changed[${i}].id`);
    requireString(n.left_kind, `node_diffs.changed[${i}].left_kind`);
    requireString(n.left_value, `node_diffs.changed[${i}].left_value`);
    requireString(n.right_kind, `node_diffs.changed[${i}].right_kind`);
    requireString(n.right_value, `node_diffs.changed[${i}].right_value`);
    if (n.status !== "conflict") die(`node_diffs.changed[${i}].status invalid`);
  }
}

function validateEdgeDiffs(edgeDiffs) {
  keyset(edgeDiffs, ["added", "changed", "removed"], "edge_diffs");
  if (!Array.isArray(edgeDiffs.added) || !Array.isArray(edgeDiffs.removed) || !Array.isArray(edgeDiffs.changed)) {
    die("edge_diffs arrays required");
  }
  for (const [i, e] of edgeDiffs.added.entries()) {
    keyset(e, ["direction", "from", "id", "label", "to"], `edge_diffs.added[${i}]`);
    requireString(e.id, `edge_diffs.added[${i}].id`);
    requireString(e.from, `edge_diffs.added[${i}].from`);
    requireString(e.to, `edge_diffs.added[${i}].to`);
    requireString(e.label, `edge_diffs.added[${i}].label`);
    requireString(e.direction, `edge_diffs.added[${i}].direction`);
  }
  for (const [i, e] of edgeDiffs.removed.entries()) {
    keyset(e, ["direction", "from", "id", "label", "to"], `edge_diffs.removed[${i}]`);
    requireString(e.id, `edge_diffs.removed[${i}].id`);
    requireString(e.from, `edge_diffs.removed[${i}].from`);
    requireString(e.to, `edge_diffs.removed[${i}].to`);
    requireString(e.label, `edge_diffs.removed[${i}].label`);
    requireString(e.direction, `edge_diffs.removed[${i}].direction`);
  }
  for (const [i, e] of edgeDiffs.changed.entries()) {
    keyset(
      e,
      ["id", "left_direction", "left_from", "left_label", "left_to", "right_direction", "right_from", "right_label", "right_to", "status"],
      `edge_diffs.changed[${i}]`,
    );
    requireString(e.id, `edge_diffs.changed[${i}].id`);
    requireString(e.left_from, `edge_diffs.changed[${i}].left_from`);
    requireString(e.left_to, `edge_diffs.changed[${i}].left_to`);
    requireString(e.left_label, `edge_diffs.changed[${i}].left_label`);
    requireString(e.left_direction, `edge_diffs.changed[${i}].left_direction`);
    requireString(e.right_from, `edge_diffs.changed[${i}].right_from`);
    requireString(e.right_to, `edge_diffs.changed[${i}].right_to`);
    requireString(e.right_label, `edge_diffs.changed[${i}].right_label`);
    requireString(e.right_direction, `edge_diffs.changed[${i}].right_direction`);
    if (e.status !== "conflict") die(`edge_diffs.changed[${i}].status invalid`);
  }
}

function validateResolution(resolution) {
  keyset(resolution, ["note", "proposal_id", "status", "strategy"], "recommended_resolution");
  requireString(resolution.note, "recommended_resolution.note");
  requireSha(resolution.proposal_id, "recommended_resolution.proposal_id");
  if (!RESOLUTION_STATUSES.has(resolution.status)) die("recommended_resolution.status invalid");
  if (!RESOLUTION_STRATEGIES.has(resolution.strategy)) die("recommended_resolution.strategy invalid");
}

function validateSummary(summary, nodeDiffs, edgeDiffs) {
  keyset(summary, ["conflict_count", "edge_added", "edge_changed", "edge_removed", "node_added", "node_changed", "node_removed"], "summary");
  const expected = buildSummary(nodeDiffs, edgeDiffs);
  if (stableStringify(summary) !== stableStringify(expected)) die("summary mismatch");
}

function validateConflictBundle(bundle) {
  assertAdvisoryOnlyShape(bundle, "conflict_bundle");
  keyset(bundle, ["authority", "digest", "edge_diffs", "left_world_digest", "node_diffs", "recommended_resolution", "right_world_digest", "summary", "v"], "conflict_bundle");
  if (bundle.v !== VERSION) die("conflict_bundle version mismatch");
  if (bundle.authority !== "advisory") die("conflict_bundle is advisory-only; authority must be advisory");
  requireSha(bundle.left_world_digest, "left_world_digest");
  requireSha(bundle.right_world_digest, "right_world_digest");
  requireSha(bundle.digest, "digest");

  validateNodeDiffs(bundle.node_diffs);
  validateEdgeDiffs(bundle.edge_diffs);
  validateResolution(bundle.recommended_resolution);
  validateSummary(bundle.summary, bundle.node_diffs, bundle.edge_diffs);
  requireStringMembrane(bundle, "conflict_bundle");

  const payload = {
    authority: bundle.authority,
    edge_diffs: bundle.edge_diffs,
    left_world_digest: bundle.left_world_digest,
    node_diffs: bundle.node_diffs,
    recommended_resolution: bundle.recommended_resolution,
    right_world_digest: bundle.right_world_digest,
    summary: bundle.summary,
    v: bundle.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(payload), "utf8"));
  if (want !== bundle.digest) die("conflict_bundle digest mismatch");
}

function buildTrace(bundle) {
  const lines = [];
  const add = (kind, payload) => lines.push(canonicalJson({ kind, payload, v: "wave17.conflict_trace.v0" }));
  for (const n of bundle.node_diffs.added) add("node_added", n);
  for (const n of bundle.node_diffs.removed) add("node_removed", n);
  for (const n of bundle.node_diffs.changed) add("node_changed", n);
  for (const e of bundle.edge_diffs.added) add("edge_added", e);
  for (const e of bundle.edge_diffs.removed) add("edge_removed", e);
  for (const e of bundle.edge_diffs.changed) add("edge_changed", e);
  return lines.join("");
}

async function emitBundle(args) {
  if (!args.leftWorld || !args.rightWorld || !args.out) {
    die("emit requires --left-world --right-world --out");
  }
  const left = await readJson(args.leftWorld);
  const right = await readJson(args.rightWorld);
  validateWorld(left, "left_world");
  validateWorld(right, "right_world");

  const nodeDiffs = diffNodes(left.nodes, right.nodes);
  const edgeDiffs = diffEdges(left.edges, right.edges);
  const summary = buildSummary(nodeDiffs, edgeDiffs);
  const strategy = args.strategy || "manual_review";
  const recommended_resolution = buildResolution(strategy);
  const left_world_digest = args.leftDigest || worldDigest(left);
  const right_world_digest = args.rightDigest || worldDigest(right);
  requireSha(left_world_digest, "left_world_digest");
  requireSha(right_world_digest, "right_world_digest");

  const payload = {
    authority: "advisory",
    edge_diffs: edgeDiffs,
    left_world_digest,
    node_diffs: nodeDiffs,
    recommended_resolution,
    right_world_digest,
    summary,
    v: VERSION,
  };
  const digest = shaPref(Buffer.from(canonicalJson(payload), "utf8"));
  const bundle = { ...payload, digest };
  validateConflictBundle(bundle);
  await writeCanonicalJson(args.out, bundle);
  if (args.outTrace) {
    await fs.writeFile(path.resolve(process.cwd(), args.outTrace), buildTrace(bundle), "utf8");
  }
  console.log(`ok mv-conflict-bundle emit digest=${bundle.digest}`);
}

async function validateBundle(args) {
  if (!args.conflictBundle) die("validate requires --conflict-bundle");
  const bundle = await readJson(args.conflictBundle);
  validateConflictBundle(bundle);
  console.log(`ok mv-conflict-bundle validate digest=${bundle.digest}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-conflict-bundle emit --left-world <left.json> --right-world <right.json> --out <bundle.json> [--out-trace <trace.ndjson>] [--strategy manual_review|prefer_left|prefer_right]");
    console.log("mv-conflict-bundle validate --conflict-bundle <bundle.json>");
    return;
  }
  if (args.mode === "emit") return emitBundle(args);
  if (args.mode === "validate") return validateBundle(args);
  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
