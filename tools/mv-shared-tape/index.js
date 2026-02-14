#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave17.shared_tape.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const STRATEGIES = new Set([
  "linear_append",
  "fork_reconcile",
  "arbitration_proposal",
  "majority_vote",
  "constitutional_override",
]);
const STATUSES = new Set(["proposed", "accepted", "rejected"]);

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
    else if (a === "--base-bundle-digest" && argv[i + 1]) out.base = argv[++i];
    else if (a === "--seed" && argv[i + 1]) out.seed = argv[++i];
    else if (a === "--shared-tape" && argv[i + 1]) out.shared = argv[++i];
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

function validateParticipants(participants) {
  if (!Array.isArray(participants)) die("participants must be array");
  const ids = new Set();
  for (const [i, p] of participants.entries()) {
    keyset(p, ["author_id", "pubkey_digest", "role"], `participants[${i}]`);
    requireSha(p.author_id, `participants[${i}].author_id`);
    requireSha(p.pubkey_digest, `participants[${i}].pubkey_digest`);
    if (typeof p.role !== "string" || p.role.length === 0) die(`participants[${i}].role invalid`);
    if (ids.has(p.author_id)) die(`duplicate participant author_id: ${p.author_id}`);
    ids.add(p.author_id);
  }
  return ids;
}

function validateBranches(branches) {
  if (!Array.isArray(branches)) die("branches must be array");
  const ids = new Set();
  const heads = new Set();
  for (const [i, b] of branches.entries()) {
    keyset(b, ["branch_id", "created_by", "head_digest", "parent_digest"], `branches[${i}]`);
    requireSha(b.branch_id, `branches[${i}].branch_id`);
    if (b.parent_digest !== "genesis") requireSha(b.parent_digest, `branches[${i}].parent_digest`);
    requireSha(b.head_digest, `branches[${i}].head_digest`);
    requireSha(b.created_by, `branches[${i}].created_by`);
    if (ids.has(b.branch_id)) die(`duplicate branch_id: ${b.branch_id}`);
    ids.add(b.branch_id);
    heads.add(b.head_digest);
  }
  return { ids, heads };
}

function validateEvents(events, authorIds, branchIds) {
  if (!Array.isArray(events)) die("events must be array");
  const perBranchT = new Map();
  const digests = new Set();
  for (const [i, e] of events.entries()) {
    keyset(e, ["author_id", "branch_id", "event_digest", "t"], `events[${i}]`);
    requireSha(e.event_digest, `events[${i}].event_digest`);
    requireSha(e.author_id, `events[${i}].author_id`);
    requireSha(e.branch_id, `events[${i}].branch_id`);
    if (!authorIds.has(e.author_id)) die(`events[${i}] unresolved author_id`);
    if (!branchIds.has(e.branch_id)) die(`events[${i}] unresolved branch_id`);
    if (!/^\d+$/.test(e.t)) die(`events[${i}].t must be decimal string`);
    const n = Number(e.t);
    const prev = perBranchT.get(e.branch_id) ?? -1;
    if (n !== prev + 1) die(`events[${i}] non-contiguous t for branch`);
    perBranchT.set(e.branch_id, n);
    if (digests.has(e.event_digest)) die(`duplicate event_digest: ${e.event_digest}`);
    digests.add(e.event_digest);
  }
  return digests;
}

function validateMergeLog(mergeLog, branchHeads) {
  if (!Array.isArray(mergeLog)) die("merge_log must be array");
  for (const [i, m] of mergeLog.entries()) {
    keyset(m, ["left_head", "merge_id", "proposed_by", "result_head", "right_head", "status", "strategy"], `merge_log[${i}]`);
    requireSha(m.merge_id, `merge_log[${i}].merge_id`);
    requireSha(m.left_head, `merge_log[${i}].left_head`);
    requireSha(m.right_head, `merge_log[${i}].right_head`);
    requireSha(m.result_head, `merge_log[${i}].result_head`);
    requireSha(m.proposed_by, `merge_log[${i}].proposed_by`);
    if (!STRATEGIES.has(m.strategy)) die(`merge_log[${i}].strategy invalid`);
    if (!STATUSES.has(m.status)) die(`merge_log[${i}].status invalid`);
    if (!branchHeads.has(m.left_head)) die(`merge_log[${i}] left_head unresolved`);
    if (!branchHeads.has(m.right_head)) die(`merge_log[${i}] right_head unresolved`);
    if (!branchHeads.has(m.result_head)) die(`merge_log[${i}] result_head unresolved`);
  }
}

function buildSummary(participants, branches, events, mergeLog) {
  return {
    branch_count: String(branches.length),
    event_count: String(events.length),
    merge_count: String(mergeLog.length),
    participant_count: String(participants.length),
  };
}

function validateSummary(summary, participants, branches, events, mergeLog) {
  keyset(summary, ["branch_count", "event_count", "merge_count", "participant_count"], "summary");
  const expected = buildSummary(participants, branches, events, mergeLog);
  if (stableStringify(summary) !== stableStringify(expected)) die("summary mismatch");
}

function validateSharedTape(obj) {
  keyset(obj, ["authority", "base_bundle_digest", "branches", "digest", "events", "merge_log", "participants", "summary", "v"], "shared_tape");
  if (obj.v !== VERSION) die("shared_tape version mismatch");
  if (obj.authority !== "advisory") die("shared_tape authority must be advisory");
  requireSha(obj.base_bundle_digest, "base_bundle_digest");
  requireSha(obj.digest, "digest");

  const authorIds = validateParticipants(obj.participants);
  const { ids: branchIds, heads } = validateBranches(obj.branches);
  validateEvents(obj.events, authorIds, branchIds);
  validateMergeLog(obj.merge_log, heads);
  validateSummary(obj.summary, obj.participants, obj.branches, obj.events, obj.merge_log);
  requireStringMembrane(obj, "shared_tape");

  const payload = {
    authority: obj.authority,
    base_bundle_digest: obj.base_bundle_digest,
    branches: obj.branches,
    events: obj.events,
    merge_log: obj.merge_log,
    participants: obj.participants,
    summary: obj.summary,
    v: obj.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(payload), "utf8"));
  if (want !== obj.digest) die("shared_tape digest mismatch");
}

function buildFromSeed(baseDigest, seed) {
  requireSha(baseDigest, "base_bundle_digest");
  keyset(seed, ["branches", "events", "merge_log", "participants"], "seed");
  const shared = {
    authority: "advisory",
    base_bundle_digest: baseDigest,
    branches: seed.branches,
    events: seed.events,
    merge_log: seed.merge_log,
    participants: seed.participants,
    summary: buildSummary(seed.participants, seed.branches, seed.events, seed.merge_log),
    v: VERSION,
  };
  validateSharedTape({ ...shared, digest: shaPref(Buffer.from(canonicalJson(shared), "utf8")) });
  const digest = shaPref(Buffer.from(canonicalJson(shared), "utf8"));
  return { ...shared, digest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-shared-tape emit --base-bundle-digest <sha256:...> --seed <seed.json> --out <shared_tape.json>");
    console.log("mv-shared-tape validate --shared-tape <shared_tape.json>");
    return;
  }

  if (args.mode === "emit") {
    if (!args.base || !args.seed || !args.out) die("emit requires --base-bundle-digest --seed --out");
    const seed = await readJson(args.seed);
    const shared = buildFromSeed(args.base, seed);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(shared), "utf8");
    console.log(`ok mv-shared-tape emit digest=${shared.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.shared) die("validate requires --shared-tape");
    const shared = await readJson(args.shared);
    validateSharedTape(shared);
    console.log(`ok mv-shared-tape validate digest=${shared.digest}`);
    return;
  }

  die("mode must be emit|validate");
}

main().catch((err) => die(err.message || String(err)));
