#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { canonicalJson, die, keyset, requireSha, requireStringMembrane, shaPref } from "../wave28-poly-lib.js";

const V = "wave30.evidence_bundle.v0";

function parseArgs(argv) {
  const out = { mode: "", evidence: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "build") out.mode = "build";
    else if (a === "verify") out.mode = "verify";
    else if (a === "--subject-digest" && argv[i + 1]) out.subjectDigest = argv[++i];
    else if (a === "--claim-type" && argv[i + 1]) out.claimType = argv[++i];
    else if (a === "--evidence" && argv[i + 1]) out.evidence.push(argv[++i]);
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--in" && argv[i + 1]) out.input = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else die(`unknown arg: ${a}`);
  }
  return out;
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(path.resolve(process.cwd(), p), "utf8"));
}

async function writeJson(p, obj) {
  await fs.writeFile(path.resolve(process.cwd(), p), canonicalJson(obj), "utf8");
}

function sortEvidence(evidence) {
  return [...evidence].sort((a, b) => (a.v === b.v ? a.digest.localeCompare(b.digest) : a.v.localeCompare(b.v)));
}

function evidenceDigest(evidence) {
  return shaPref(Buffer.from(canonicalJson(evidence), "utf8"));
}

function validateEvidenceRef(x, idx) {
  keyset(x, ["digest", "v"], `evidence[${idx}]`);
  if (typeof x.v !== "string" || x.v.length === 0) die(`evidence[${idx}].v invalid`);
  requireSha(x.digest, `evidence[${idx}].digest`);
}

function validateBundle(bundle) {
  keyset(bundle, ["authority", "claim_type", "digest", "evidence", "evidence_digest", "subject_digest", "v"], "evidence_bundle");
  if (bundle.v !== V) die("evidence_bundle version mismatch");
  if (bundle.authority !== "advisory") die("evidence_bundle authority must be advisory");
  requireSha(bundle.subject_digest, "evidence_bundle.subject_digest");
  if (typeof bundle.claim_type !== "string" || bundle.claim_type.length === 0) die("evidence_bundle.claim_type invalid");
  requireSha(bundle.evidence_digest, "evidence_bundle.evidence_digest");
  requireSha(bundle.digest, "evidence_bundle.digest");
  if (!Array.isArray(bundle.evidence) || bundle.evidence.length === 0) die("evidence_bundle evidence must be non-empty array");

  bundle.evidence.forEach(validateEvidenceRef);
  const sorted = sortEvidence(bundle.evidence);
  if (JSON.stringify(sorted) !== JSON.stringify(bundle.evidence)) die("evidence_bundle evidence ordering mismatch");
  if (new Set(bundle.evidence.map((e) => `${e.v}|${e.digest}`)).size !== bundle.evidence.length) {
    die("evidence_bundle evidence contains duplicates");
  }

  const wantEvidenceDigest = evidenceDigest(bundle.evidence);
  if (wantEvidenceDigest !== bundle.evidence_digest) die("evidence_bundle evidence_digest mismatch");

  requireStringMembrane(bundle, "evidence_bundle");
  const body = {
    authority: bundle.authority,
    claim_type: bundle.claim_type,
    evidence: bundle.evidence,
    evidence_digest: bundle.evidence_digest,
    subject_digest: bundle.subject_digest,
    v: bundle.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== bundle.digest) die("evidence_bundle digest mismatch");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.mode) {
    console.log("mv-evidence-bundle build --subject-digest <sha256:...> --claim-type <type> --evidence <artifact.json>... --out <bundle.json>");
    console.log("mv-evidence-bundle verify --in <bundle.json>");
    return;
  }

  if (args.mode === "build") {
    if (!args.subjectDigest || !args.claimType || !args.out || args.evidence.length === 0) {
      die("build requires --subject-digest --claim-type --evidence... --out");
    }
    requireSha(args.subjectDigest, "subject_digest");
    const refs = [];
    for (const p of args.evidence) {
      const x = await readJson(p);
      if (!x || typeof x !== "object") die(`evidence artifact not object: ${p}`);
      if (x.authority !== "advisory") die(`evidence artifact authority must be advisory: ${p}`);
      if (typeof x.v !== "string" || typeof x.digest !== "string") die(`evidence artifact missing v/digest: ${p}`);
      requireSha(x.digest, `evidence(${p}).digest`);
      refs.push({ v: x.v, digest: x.digest });
    }
    const evidence = sortEvidence(refs);
    if (new Set(evidence.map((e) => `${e.v}|${e.digest}`)).size !== evidence.length) die("evidence refs contain duplicates");

    const body = {
      authority: "advisory",
      claim_type: args.claimType,
      evidence,
      evidence_digest: evidenceDigest(evidence),
      subject_digest: args.subjectDigest,
      v: V,
    };
    const out = { ...body, digest: shaPref(Buffer.from(canonicalJson(body), "utf8")) };
    validateBundle(out);
    await writeJson(args.out, out);
    console.log(`ok mv-evidence-bundle build digest=${out.digest}`);
    return;
  }

  if (args.mode === "verify") {
    if (!args.input) die("verify requires --in");
    const x = await readJson(args.input);
    validateBundle(x);
    console.log(`ok mv-evidence-bundle verify digest=${x.digest}`);
    return;
  }

  die("mode must be build|verify");
}

main().catch((e) => die(e.message || String(e)));
