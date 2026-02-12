#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave16.proposal_bundle.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const ACTION_KINDS = new Set(["annotate_node"]);

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "emit") out.mode = "emit";
    else if (a === "validate") out.mode = "validate";
    else if (a === "--base-bundle-digest" && argv[i + 1]) out.base = argv[++i];
    else if (a === "--author" && argv[i + 1]) out.author = argv[++i];
    else if (a === "--actions" && argv[i + 1]) out.actions = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--proposal" && argv[i + 1]) out.proposal = argv[++i];
    else if (a === "--help" || a === "-h") out.help = "1";
    else die(`unknown arg: ${a}`);
  }
  return out;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
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

function requireSha(v, ctx) {
  if (typeof v !== "string") die(`${ctx} must be string`);
  if (!SHA_RE.test(v)) die(`${ctx} must be sha256:<64hex>`);
}

function requireString(v, ctx) {
  if (typeof v !== "string" || v.length === 0) die(`${ctx} must be non-empty string`);
}

function keyset(obj, keys, ctx) {
  const got = Object.keys(obj).sort().join(",");
  const want = [...keys].sort().join(",");
  if (got !== want) die(`${ctx} keyset mismatch`);
}

function normalizeActions(actions) {
  if (!Array.isArray(actions)) die("actions must be array");
  const out = actions.map((a, i) => {
    if (!a || typeof a !== "object" || Array.isArray(a)) die(`actions[${i}] must be object`);
    keyset(a, ["kind", "payload", "target"], `actions[${i}]`);
    requireString(a.kind, `actions[${i}].kind`);
    if (!ACTION_KINDS.has(a.kind)) die(`actions[${i}].kind invalid`);
    requireSha(a.target, `actions[${i}].target`);
    if (!a.payload || typeof a.payload !== "object" || Array.isArray(a.payload)) die(`actions[${i}].payload must be object`);
    for (const [k, v] of Object.entries(a.payload)) {
      if (typeof k !== "string" || !k) die(`actions[${i}].payload key invalid`);
      if (typeof v !== "string") die(`actions[${i}].payload.${k} must be string`);
    }
    return { kind: a.kind, payload: a.payload, target: a.target };
  });

  out.sort((x, y) => {
    const tx = `${x.target}|${x.kind}|${stableStringify(x.payload)}`;
    const ty = `${y.target}|${y.kind}|${stableStringify(y.payload)}`;
    return tx.localeCompare(ty);
  });
  return out;
}

function proposalDigest(payload) {
  return shaPref(Buffer.from(canonicalJson(payload), "utf8"));
}

function buildProposal(baseDigest, author, actions) {
  requireSha(baseDigest, "base_bundle_digest");
  requireString(author, "author");
  const normalized = normalizeActions(actions);
  const payload = {
    actions: normalized,
    author,
    base_bundle_digest: baseDigest,
    summary: {
      action_count: String(normalized.length),
      authority: "advisory",
    },
    v: VERSION,
  };
  const digest = proposalDigest(payload);
  return {
    ...payload,
    digest,
  };
}

function validateProposal(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) die("proposal must be object");
  keyset(obj, ["actions", "author", "base_bundle_digest", "digest", "summary", "v"], "proposal");
  if (obj.v !== VERSION) die("proposal version mismatch");
  requireSha(obj.base_bundle_digest, "proposal.base_bundle_digest");
  requireString(obj.author, "proposal.author");
  if (!obj.summary || typeof obj.summary !== "object" || Array.isArray(obj.summary)) die("proposal.summary must be object");
  keyset(obj.summary, ["action_count", "authority"], "proposal.summary");
  if (obj.summary.authority !== "advisory") die("proposal.summary.authority must be advisory");
  if (typeof obj.summary.action_count !== "string" || !/^\d+$/.test(obj.summary.action_count)) die("proposal.summary.action_count must be decimal string");
  requireSha(obj.digest, "proposal.digest");

  const normalized = normalizeActions(obj.actions);
  if (Number(obj.summary.action_count) !== normalized.length) die("proposal.summary.action_count mismatch");

  const payload = {
    actions: normalized,
    author: obj.author,
    base_bundle_digest: obj.base_bundle_digest,
    summary: obj.summary,
    v: obj.v,
  };
  const want = proposalDigest(payload);
  if (obj.digest !== want) die("proposal digest mismatch");
  return want;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-proposal-bundle emit --base-bundle-digest <sha256:...> --author <id> --actions <actions.json> --out <proposal.json>");
    console.log("mv-proposal-bundle validate --proposal <proposal.json>");
    return;
  }

  if (args.mode === "emit") {
    if (!args.base || !args.author || !args.actions || !args.out) die("emit requires --base-bundle-digest --author --actions --out");
    const actionsObj = JSON.parse(await fs.readFile(path.resolve(process.cwd(), args.actions), "utf8"));
    const proposal = buildProposal(args.base, args.author, actionsObj);
    await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(proposal), "utf8");
    console.log(`ok mv-proposal-bundle emit digest=${proposal.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.proposal) die("validate requires --proposal");
    const obj = JSON.parse(await fs.readFile(path.resolve(process.cwd(), args.proposal), "utf8"));
    const digest = validateProposal(obj);
    console.log(`ok mv-proposal-bundle validate digest=${digest}`);
    return;
  }

  die("mode must be emit or validate");
}

main().catch((err) => die(err.message || String(err)));
