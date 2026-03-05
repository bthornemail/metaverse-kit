#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave17.merge_review.v0";
const CONFLICT_BUNDLE_VERSION = "wave17.conflict_bundle.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
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

function requireStringValue(v, ctx) {
  if (typeof v !== "string") die(`${ctx} must be string`);
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
      die(`merge_review is advisory-only; forbidden field: ${ctx}.${k}`);
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
    else if (a === "--conflict-bundle" && argv[i + 1]) out.conflictBundle = argv[++i];
    else if (a === "--merge-review" && argv[i + 1]) out.mergeReview = argv[++i];
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

async function writeCanonicalJson(p, obj) {
  await fs.writeFile(path.resolve(process.cwd(), p), canonicalJson(obj), "utf8");
}

function sortGroups(groups) {
  return [...groups].sort((a, b) => a.group_id.localeCompare(b.group_id));
}

function normalizeSide(patch = {}) {
  return {
    direction: patch.direction || "",
    from: patch.from || "",
    id: patch.id || "",
    kind: patch.kind || "",
    label: patch.label || "",
    to: patch.to || "",
    value: patch.value || "",
  };
}

function groupFromNodeChanged(n) {
  return {
    group_id: n.id,
    kind: "node",
    left: normalizeSide({ id: n.id, kind: n.left_kind, value: n.left_value }),
    right: normalizeSide({ id: n.id, kind: n.right_kind, value: n.right_value }),
    status: "conflict",
  };
}

function groupFromNodeAdded(n) {
  return {
    group_id: n.id,
    kind: "node",
    left: normalizeSide({ id: n.id }),
    right: normalizeSide({ id: n.id, kind: n.kind, value: n.value }),
    status: "right_only",
  };
}

function groupFromNodeRemoved(n) {
  return {
    group_id: n.id,
    kind: "node",
    left: normalizeSide({ id: n.id, kind: n.kind, value: n.value }),
    right: normalizeSide({ id: n.id }),
    status: "left_only",
  };
}

function groupFromEdgeChanged(e) {
  return {
    group_id: e.id,
    kind: "edge",
    left: normalizeSide({ id: e.id, from: e.left_from, to: e.left_to, label: e.left_label, direction: e.left_direction }),
    right: normalizeSide({ id: e.id, from: e.right_from, to: e.right_to, label: e.right_label, direction: e.right_direction }),
    status: "conflict",
  };
}

function groupFromEdgeAdded(e) {
  return {
    group_id: e.id,
    kind: "edge",
    left: normalizeSide({ id: e.id }),
    right: normalizeSide({ id: e.id, from: e.from, to: e.to, label: e.label, direction: e.direction }),
    status: "right_only",
  };
}

function groupFromEdgeRemoved(e) {
  return {
    group_id: e.id,
    kind: "edge",
    left: normalizeSide({ id: e.id, from: e.from, to: e.to, label: e.label, direction: e.direction }),
    right: normalizeSide({ id: e.id }),
    status: "left_only",
  };
}

function buildSummary(groups) {
  let conflict = 0;
  let leftOnly = 0;
  let rightOnly = 0;
  for (const g of groups) {
    if (g.status === "conflict") conflict += 1;
    if (g.status === "left_only") leftOnly += 1;
    if (g.status === "right_only") rightOnly += 1;
  }
  return {
    conflict_count: String(conflict),
    group_count: String(groups.length),
    left_only_count: String(leftOnly),
    non_conflict_count: String(leftOnly + rightOnly),
    right_only_count: String(rightOnly),
  };
}

function buildRenderHints() {
  return {
    default_group: "conflict",
    sort_order: "group_id_lexicographic",
    view_mode: "advisory_review",
  };
}

function validateConflictBundle(bundle) {
  keyset(bundle, ["authority", "digest", "edge_diffs", "left_world_digest", "node_diffs", "recommended_resolution", "right_world_digest", "summary", "v"], "conflict_bundle");
  if (bundle.v !== CONFLICT_BUNDLE_VERSION) die("conflict_bundle version mismatch");
  if (bundle.authority !== "advisory") die("conflict_bundle authority must be advisory");
  requireSha(bundle.digest, "conflict_bundle.digest");
  requireSha(bundle.left_world_digest, "conflict_bundle.left_world_digest");
  requireSha(bundle.right_world_digest, "conflict_bundle.right_world_digest");
  keyset(bundle.node_diffs, ["added", "changed", "removed"], "conflict_bundle.node_diffs");
  keyset(bundle.edge_diffs, ["added", "changed", "removed"], "conflict_bundle.edge_diffs");
}

function validateGroupSide(side, ctx) {
  keyset(side, ["direction", "from", "id", "kind", "label", "to", "value"], ctx);
  requireStringValue(side.direction, `${ctx}.direction`);
  requireStringValue(side.from, `${ctx}.from`);
  requireStringValue(side.id, `${ctx}.id`);
  requireStringValue(side.kind, `${ctx}.kind`);
  requireStringValue(side.label, `${ctx}.label`);
  requireStringValue(side.to, `${ctx}.to`);
  requireStringValue(side.value, `${ctx}.value`);
}

function validateGroups(groups) {
  if (!Array.isArray(groups)) die("groups must be array");
  const ids = new Set();
  for (const [i, g] of groups.entries()) {
    keyset(g, ["group_id", "kind", "left", "right", "status"], `groups[${i}]`);
    requireString(g.group_id, `groups[${i}].group_id`);
    if (!/^node:|^edge:/.test(g.group_id)) die(`groups[${i}].group_id invalid prefix`);
    if (g.kind !== "node" && g.kind !== "edge") die(`groups[${i}].kind invalid`);
    if (!["conflict", "left_only", "right_only"].includes(g.status)) die(`groups[${i}].status invalid`);
    if (ids.has(g.group_id)) die(`groups duplicate group_id: ${g.group_id}`);
    ids.add(g.group_id);
    validateGroupSide(g.left, `groups[${i}].left`);
    validateGroupSide(g.right, `groups[${i}].right`);
  }
  const sorted = sortGroups(groups);
  if (stableStringify(sorted) !== stableStringify(groups)) {
    die("groups must be sorted by group_id lexicographic");
  }
}

function validateSummary(summary, groups) {
  keyset(summary, ["conflict_count", "group_count", "left_only_count", "non_conflict_count", "right_only_count"], "summary");
  const expected = buildSummary(groups);
  if (stableStringify(summary) !== stableStringify(expected)) die("summary mismatch");
}

function validateRenderHints(hints) {
  keyset(hints, ["default_group", "sort_order", "view_mode"], "render_hints");
  if (hints.default_group !== "conflict") die("render_hints.default_group invalid");
  if (hints.sort_order !== "group_id_lexicographic") die("render_hints.sort_order invalid");
  if (hints.view_mode !== "advisory_review") die("render_hints.view_mode invalid");
}

function validateMergeReview(review) {
  assertAdvisoryOnlyShape(review, "merge_review");
  keyset(review, ["authority", "bundle_digest", "digest", "groups", "render_hints", "summary", "v"], "merge_review");
  if (review.v !== VERSION) die("merge_review version mismatch");
  if (review.authority !== "advisory") die("merge_review is advisory-only; authority must be advisory");
  requireSha(review.bundle_digest, "bundle_digest");
  requireSha(review.digest, "digest");

  validateGroups(review.groups);
  validateSummary(review.summary, review.groups);
  validateRenderHints(review.render_hints);

  requireStringMembrane(review, "merge_review");

  const payload = {
    authority: review.authority,
    bundle_digest: review.bundle_digest,
    groups: review.groups,
    render_hints: review.render_hints,
    summary: review.summary,
    v: review.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(payload), "utf8"));
  if (want !== review.digest) die("merge_review digest mismatch");
}

function buildFromConflictBundle(bundle) {
  validateConflictBundle(bundle);
  const groups = [];
  for (const n of bundle.node_diffs.changed) groups.push(groupFromNodeChanged(n));
  for (const e of bundle.edge_diffs.changed) groups.push(groupFromEdgeChanged(e));
  for (const n of bundle.node_diffs.added) groups.push(groupFromNodeAdded(n));
  for (const e of bundle.edge_diffs.added) groups.push(groupFromEdgeAdded(e));
  for (const n of bundle.node_diffs.removed) groups.push(groupFromNodeRemoved(n));
  for (const e of bundle.edge_diffs.removed) groups.push(groupFromEdgeRemoved(e));

  const sortedGroups = sortGroups(groups);
  const review = {
    authority: "advisory",
    bundle_digest: bundle.digest,
    groups: sortedGroups,
    render_hints: buildRenderHints(),
    summary: buildSummary(sortedGroups),
    v: VERSION,
  };

  const digest = shaPref(Buffer.from(canonicalJson(review), "utf8"));
  return { ...review, digest };
}

async function emitReview(args) {
  if (!args.conflictBundle || !args.out) die("emit requires --conflict-bundle --out");
  const bundle = await readJson(args.conflictBundle);
  const review = buildFromConflictBundle(bundle);
  validateMergeReview(review);
  await writeCanonicalJson(args.out, review);
  console.log(`ok mv-merge-review emit digest=${review.digest}`);
}

async function validateReview(args) {
  if (!args.mergeReview) die("validate requires --merge-review");
  const review = await readJson(args.mergeReview);
  validateMergeReview(review);
  console.log(`ok mv-merge-review validate digest=${review.digest}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-merge-review emit --conflict-bundle <bundle.json> --out <merge-review.json>");
    console.log("mv-merge-review validate --merge-review <merge-review.json>");
    return;
  }
  if (args.mode === "emit") return emitReview(args);
  if (args.mode === "validate") return validateReview(args);
  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
