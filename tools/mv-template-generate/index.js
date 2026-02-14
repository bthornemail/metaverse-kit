#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const GENERATOR_ID = "wave16.gen.solon.constitution.v0";
const PROPOSAL_VERSION = "wave16.proposal_bundle.v0";
const TAPE_VERSION = "wave16.interaction_tape.v0";
const NARRATIVE_VERSION = "wave16.narrative_state.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base-bundle-digest" && argv[i + 1]) out.base = argv[++i];
    else if (a === "--narrative-state" && argv[i + 1]) out.narrative = argv[++i];
    else if (a === "--interaction-tape" && argv[i + 1]) out.tape = argv[++i];
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

function requireSha(v, ctx) {
  if (typeof v !== "string" || !SHA_RE.test(v)) die(`${ctx} invalid sha256`);
}

function keyset(obj, expected, ctx) {
  const got = Object.keys(obj).sort().join(",");
  const want = [...expected].sort().join(",");
  if (got !== want) die(`${ctx} keyset mismatch`);
}

function readJson(p) {
  return fs.readFile(path.resolve(process.cwd(), p), "utf8").then((s) => JSON.parse(s));
}

function readBytes(p) {
  return fs.readFile(path.resolve(process.cwd(), p));
}

function validateNarrative(n) {
  if (!n || typeof n !== "object" || Array.isArray(n)) die("narrative invalid");
  if (n.v !== NARRATIVE_VERSION) die("narrative version mismatch");
  if (!Array.isArray(n.states)) die("narrative states missing");
}

function validateTape(t) {
  keyset(t, ["authority", "base_bundle_digest", "digest", "events", "narrative_state_digest", "v"], "tape");
  if (t.v !== TAPE_VERSION) die("tape version mismatch");
  if (t.authority !== "advisory") die("tape authority must be advisory");
  requireSha(t.base_bundle_digest, "tape.base_bundle_digest");
  requireSha(t.narrative_state_digest, "tape.narrative_state_digest");
  requireSha(t.digest, "tape.digest");
  if (!Array.isArray(t.events)) die("tape.events missing");
}

function findStateByPath(narrative, exactPath) {
  return narrative.states.find((s) => s && s.source_path === exactPath);
}

function mustHavePathState(narrative, p) {
  const s = findStateByPath(narrative, p);
  if (!s) die(`required narrative state missing: ${p}`);
  return s;
}

function validateSolonPath(tape, preludeId, article2Id) {
  const events = tape.events;
  if (events.length < 5) die("interaction tape too short for solon generator");

  const hasPrelude = events.some((e) => e.verb === "OPEN_PASSAGE" && e.target === preludeId);
  const hasArticle2 = events.some((e) => e.verb === "OPEN_PASSAGE" && e.target === article2Id);
  const hasStance = events.some((e) => e.verb === "SET_STANCE" && e.target === "solon");
  const hasSelect = events.some((e) => e.verb === "SELECT_GENERATOR" && e.target === GENERATOR_ID);
  const hasGenerate = events.some((e) => e.verb === "GENERATE_PROPOSAL" && e.target === GENERATOR_ID);

  if (!hasPrelude) die("missing PRELUDE/02 interaction");
  if (!hasArticle2) die("missing ARTICLE II interaction");
  if (!hasStance) die("missing SET_STANCE solon interaction");
  if (!hasSelect) die("missing SELECT_GENERATOR interaction");
  if (!hasGenerate) die("missing GENERATE_PROPOSAL interaction");
}

function buildProposal(baseDigest, narrativeDigest, tapeDigest, preludeState, article2State) {
  const payload = {
    amendment_policy: "slow",
    provenance: {
      article_ii_state_id: article2State.id,
      prelude_02_state_id: preludeState.id,
      source_state_digests: [preludeState.digest, article2State.digest],
    },
    roles: ["council", "steward", "auditor"],
    rule_nodes: ["due_process", "appeal", "publication"],
    stance: "solon",
  };
  const body = {
    authority: "advisory",
    base_bundle_digest: baseDigest,
    generator_id: GENERATOR_ID,
    interaction_tape_digest: tapeDigest,
    narrative_state_digest: narrativeDigest,
    payload,
    v: PROPOSAL_VERSION,
  };
  const digest = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  return { ...body, digest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.base || !args.narrative || !args.tape || !args.out) {
    console.log("mv-template-generate --base-bundle-digest <sha256:...> --narrative-state <state.json> --interaction-tape <tape.json> --out <proposal.json>");
    return;
  }
  requireSha(args.base, "base_bundle_digest");

  const [narrativeBytes, narrative, tape] = await Promise.all([readBytes(args.narrative), readJson(args.narrative), readJson(args.tape)]);
  validateNarrative(narrative);
  validateTape(tape);

  const narrativeDigest = shaPref(narrativeBytes);
  if (tape.narrative_state_digest !== narrativeDigest) die("tape narrative_state_digest mismatch");
  if (tape.base_bundle_digest !== args.base) die("tape base_bundle_digest mismatch");

  const preludeState = mustHavePathState(narrative, "PRELUDE/On the Turning Away from the Word .md");
  const article2State = mustHavePathState(narrative, "ARTICLE II.md");

  validateSolonPath(tape, preludeState.id, article2State.id);
  const proposal = buildProposal(args.base, narrativeDigest, tape.digest, preludeState, article2State);

  await fs.writeFile(path.resolve(process.cwd(), args.out), canonicalJson(proposal), "utf8");
  console.log(`ok mv-template-generate digest=${proposal.digest}`);
}

main().catch((err) => die(err.message || String(err)));
