#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const INPUT_VERSION = "wave17.merge_review.v0";
const SUMMARY_VERSION = "wave17.merge_review_summary.v0";
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
  if (typeof v !== "string") die(`${ctx} must be string`);
}

function assertAdvisoryOnlyShape(v, ctx) {
  if (Array.isArray(v)) {
    v.forEach((item, i) => assertAdvisoryOnlyShape(item, `${ctx}[${i}]`));
    return;
  }
  if (!v || typeof v !== "object") return;

  for (const [k, inner] of Object.entries(v)) {
    if (FORBIDDEN_AUTHORITY_KEYS.has(k)) {
      die(`merge_review renderer is advisory-only; forbidden field: ${ctx}.${k}`);
    }
    assertAdvisoryOnlyShape(inner, `${ctx}.${k}`);
  }
}

function parseArgs(argv) {
  const out = { format: "both", strict: true, evidence: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "render") out.mode = "render";
    else if (a === "--in" && argv[i + 1]) out.input = argv[++i];
    else if (a === "--out-md" && argv[i + 1]) out.outMd = argv[++i];
    else if (a === "--out-json" && argv[i + 1]) out.outJson = argv[++i];
    else if (a === "--evidence" && argv[i + 1]) out.evidence.push(argv[++i]);
    else if (a === "--format" && argv[i + 1]) out.format = argv[++i];
    else if (a === "--strict") out.strict = true;
    else if (a === "--no-strict") out.strict = false;
    else if (a === "--help" || a === "-h") out.help = true;
    else die(`unknown arg: ${a}`);
  }
  return out;
}

async function readJson(p) {
  const raw = await fs.readFile(path.resolve(process.cwd(), p), "utf8");
  return JSON.parse(raw);
}

async function writeUtf8(p, text) {
  await fs.writeFile(path.resolve(process.cwd(), p), text, "utf8");
}

function validateGroupSide(side, ctx, strict) {
  if (strict) keyset(side, ["direction", "from", "id", "kind", "label", "to", "value"], ctx);
  for (const k of ["direction", "from", "id", "kind", "label", "to", "value"]) {
    requireString(side[k] ?? "", `${ctx}.${k}`);
  }
}

function validateMergeReview(review, strict) {
  assertAdvisoryOnlyShape(review, "merge_review");

  if (strict) {
    keyset(review, ["authority", "bundle_digest", "digest", "groups", "render_hints", "summary", "v"], "merge_review");
  }

  if (review.v !== INPUT_VERSION) die("merge_review version mismatch");
  if (review.authority !== "advisory") die("merge_review renderer is advisory-only; authority must be advisory");
  requireSha(review.bundle_digest, "bundle_digest");
  requireSha(review.digest, "digest");

  if (!Array.isArray(review.groups)) die("groups must be array");
  const sorted = [...review.groups].sort((a, b) => String(a.group_id).localeCompare(String(b.group_id)));
  if (stableStringify(sorted) !== stableStringify(review.groups)) die("groups must be sorted by group_id lexicographic");

  for (const [i, g] of review.groups.entries()) {
    if (strict) keyset(g, ["group_id", "kind", "left", "right", "status"], `groups[${i}]`);
    requireString(g.group_id, `groups[${i}].group_id`);
    if (!/^node:|^edge:/.test(g.group_id)) die(`groups[${i}].group_id invalid prefix`);
    if (!["node", "edge"].includes(g.kind)) die(`groups[${i}].kind invalid`);
    if (!["conflict", "left_only", "right_only"].includes(g.status)) die(`groups[${i}].status invalid`);
    validateGroupSide(g.left || {}, `groups[${i}].left`, strict);
    validateGroupSide(g.right || {}, `groups[${i}].right`, strict);
  }

  if (strict) keyset(review.summary, ["conflict_count", "group_count", "left_only_count", "non_conflict_count", "right_only_count"], "summary");
  for (const k of ["conflict_count", "group_count", "left_only_count", "non_conflict_count", "right_only_count"]) {
    if (!/^\d+$/.test(review.summary?.[k] ?? "")) die(`summary.${k} must be decimal string`);
  }

  if (strict) keyset(review.render_hints, ["default_group", "sort_order", "view_mode"], "render_hints");
  if (review.render_hints?.default_group !== "conflict") die("render_hints.default_group invalid");
  if (review.render_hints?.sort_order !== "group_id_lexicographic") die("render_hints.sort_order invalid");
  if (review.render_hints?.view_mode !== "advisory_review") die("render_hints.view_mode invalid");
}

function validateSignalProjection(x, strict) {
  if (strict) keyset(x, ["authority", "digest", "input_poly", "norm_id", "poly_decomp_digest", "source_digest", "source_type", "v"], "evidence.signal_projection");
  if (x.v !== "wave28.signal_poly_projection.v0") die("evidence signal projection version mismatch");
  if (x.authority !== "advisory") die("evidence signal projection authority must be advisory");
  requireSha(x.digest, "evidence.signal_projection.digest");
  requireSha(x.source_digest, "evidence.signal_projection.source_digest");
  if (typeof x.poly_decomp_digest !== "string") die("evidence.signal_projection.poly_decomp_digest must be string");
  if (x.poly_decomp_digest !== "") requireSha(x.poly_decomp_digest, "evidence.signal_projection.poly_decomp_digest");
  if (typeof x.input_poly !== "string" || x.input_poly.length === 0) die("evidence.signal_projection.input_poly invalid");

  const body = {
    authority: x.authority,
    input_poly: x.input_poly,
    norm_id: x.norm_id,
    poly_decomp_digest: x.poly_decomp_digest,
    source_digest: x.source_digest,
    source_type: x.source_type,
    v: x.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== x.digest) die("evidence signal projection digest mismatch");
  return { role: "signal_poly_projection", v: x.v, digest: x.digest };
}

function validatePolyDecomp(x, strict) {
  if (strict) keyset(x, ["authority", "basis_digest", "closed_config_digest", "coeff_vector", "digest", "input_poly", "norm_id", "residual_poly", "v"], "evidence.poly_decomp");
  if (x.v !== "wave28.poly_decomp.v0") die("evidence poly_decomp version mismatch");
  if (x.authority !== "advisory") die("evidence poly_decomp authority must be advisory");
  requireSha(x.digest, "evidence.poly_decomp.digest");
  requireSha(x.basis_digest, "evidence.poly_decomp.basis_digest");
  requireSha(x.closed_config_digest, "evidence.poly_decomp.closed_config_digest");
  if (!Array.isArray(x.coeff_vector) || x.coeff_vector.some((v) => v !== "0" && v !== "1")) die("evidence poly_decomp coeff_vector invalid");
  if (typeof x.input_poly !== "string" || x.input_poly.length === 0) die("evidence poly_decomp input_poly invalid");
  if (typeof x.residual_poly !== "string" || x.residual_poly.length === 0) die("evidence poly_decomp residual_poly invalid");

  const body = {
    authority: x.authority,
    basis_digest: x.basis_digest,
    closed_config_digest: x.closed_config_digest,
    coeff_vector: x.coeff_vector,
    input_poly: x.input_poly,
    norm_id: x.norm_id,
    residual_poly: x.residual_poly,
    v: x.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== x.digest) die("evidence poly_decomp digest mismatch");
  return { role: "poly_decomp", v: x.v, digest: x.digest };
}

function validatePointerResidual(x, strict) {
  if (strict) keyset(x, ["authority", "candidate_a", "candidate_b", "digest", "fail_k", "p_before", "reflect_id", "ring_fingerprint", "turn_clock_id", "turn_project_id", "v"], "evidence.pointer_residual");
  if (x.v !== "wave27.pointer_sync_residual.v0") die("evidence pointer residual version mismatch");
  if (x.authority !== "advisory") die("evidence pointer residual authority must be advisory");
  requireSha(x.digest, "evidence.pointer_residual.digest");
  requireSha(x.ring_fingerprint, "evidence.pointer_residual.ring_fingerprint");
  for (const f of ["candidate_a", "candidate_b", "fail_k", "p_before", "reflect_id", "turn_clock_id", "turn_project_id"]) {
    requireString(x[f], `evidence.pointer_residual.${f}`);
  }

  const body = {
    authority: x.authority,
    candidate_a: x.candidate_a,
    candidate_b: x.candidate_b,
    fail_k: x.fail_k,
    p_before: x.p_before,
    reflect_id: x.reflect_id,
    ring_fingerprint: x.ring_fingerprint,
    turn_clock_id: x.turn_clock_id,
    turn_project_id: x.turn_project_id,
    v: x.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== x.digest) die("evidence pointer residual digest mismatch");
  return { role: "pointer_residual", v: x.v, digest: x.digest };
}

function validateEvidenceArtifact(x, strict) {
  assertAdvisoryOnlyShape(x, "evidence");
  if (!x || typeof x !== "object") die("evidence artifact must be object");
  requireString(x.v ?? "", "evidence.v");
  if (x.v === "wave28.signal_poly_projection.v0") return validateSignalProjection(x, strict);
  if (x.v === "wave28.poly_decomp.v0") return validatePolyDecomp(x, strict);
  if (x.v === "wave27.pointer_sync_residual.v0") return validatePointerResidual(x, strict);
  die("evidence artifact version not supported");
}

function toCount(n) {
  return String(n);
}

function deriveStatus(groups) {
  const hasConflict = groups.some((g) => g.status === "conflict");
  return hasConflict ? "conflict" : "mergeable";
}

function buildSummaryJson(review, evidence) {
  const conflicts = [];
  const rejections = [];
  const changedEntities = [];
  const changedEdges = [];

  for (const g of review.groups) {
    if (g.status === "conflict") {
      conflicts.push({
        group_id: g.group_id,
        kind: g.kind,
        left_digest: shaPref(Buffer.from(canonicalJson(g.left), "utf8")),
        right_digest: shaPref(Buffer.from(canonicalJson(g.right), "utf8")),
        resolution: "manual",
      });
    }
    if (g.status === "left_only" || g.status === "right_only") {
      rejections.push({
        group_id: g.group_id,
        reason: g.status,
        digest: shaPref(Buffer.from(canonicalJson(g), "utf8")),
      });
    }
    if (g.kind === "node") changedEntities.push(g.group_id);
    if (g.kind === "edge") changedEdges.push(g.group_id);
  }

  conflicts.sort((a, b) => a.group_id.localeCompare(b.group_id));
  rejections.sort((a, b) => a.group_id.localeCompare(b.group_id));
  changedEntities.sort();
  changedEdges.sort();

  const evidenceDigest = shaPref(Buffer.from(canonicalJson(evidence), "utf8"));

  const body = {
    authority: "advisory",
    bundle_digest: review.bundle_digest,
    changed_edges: changedEdges,
    changed_entities: changedEntities,
    conflicts,
    counts: {
      changed_edges: toCount(changedEdges.length),
      changed_entities: toCount(changedEntities.length),
      conflicts: toCount(conflicts.length),
      rejected_components: toCount(rejections.length),
    },
    evidence,
    evidence_digest: evidenceDigest,
    input_digest: review.digest,
    rejected_components: rejections,
    status: deriveStatus(review.groups),
    v: SUMMARY_VERSION,
  };

  const digest = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  return { ...body, digest };
}

function buildMarkdown(summary) {
  const lines = [];
  lines.push(`# Merge Review Summary (${INPUT_VERSION})`);
  lines.push("");
  lines.push(`- authority: ${summary.authority}`);
  lines.push(`- bundle_digest: ${summary.bundle_digest}`);
  lines.push(`- input_digest: ${summary.input_digest}`);
  lines.push(`- status: ${summary.status}`);
  lines.push(`- evidence_digest: ${summary.evidence_digest}`);
  lines.push("");

  lines.push("## Overview");
  lines.push(`- conflicts: ${summary.counts.conflicts}`);
  lines.push(`- rejected_components: ${summary.counts.rejected_components}`);
  lines.push(`- changed_entities: ${summary.counts.changed_entities}`);
  lines.push(`- changed_edges: ${summary.counts.changed_edges}`);
  lines.push("");

  lines.push("## Conflicts");
  if (summary.conflicts.length === 0) {
    lines.push("- none");
  } else {
    lines.push("| group_id | kind | left_digest | right_digest | resolution |");
    lines.push("|---|---|---|---|---|");
    for (const c of summary.conflicts) {
      lines.push(`| ${c.group_id} | ${c.kind} | ${c.left_digest} | ${c.right_digest} | ${c.resolution} |`);
    }
  }
  lines.push("");

  lines.push("## Rejected Components");
  if (summary.rejected_components.length === 0) {
    lines.push("- none");
  } else {
    lines.push("| group_id | reason | digest |");
    lines.push("|---|---|---|");
    for (const r of summary.rejected_components) {
      lines.push(`| ${r.group_id} | ${r.reason} | ${r.digest} |`);
    }
  }
  lines.push("");

  lines.push("## Evidence");
  if (!summary.evidence || summary.evidence.length === 0) {
    lines.push("- none");
  } else {
    lines.push("| role | v | digest |");
    lines.push("|---|---|---|");
    for (const e of summary.evidence) {
      lines.push(`| ${e.role} | ${e.v} | ${e.digest} |`);
    }
  }
  lines.push("");

  lines.push("## Footer");
  lines.push(`- evidence_digest: ${summary.evidence_digest}`);
  lines.push(`- summary_digest: ${summary.digest}`);
  lines.push(`- generated_by: mv-merge-review-render`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.mode) {
    console.log("mv-merge-review-render render --in <merge-review.v0.json> [--out-md out.md] [--out-json out.json] [--format md|json|both] [--strict|--no-strict]");
    return;
  }

  if (args.mode !== "render") die("mode must be render");
  if (!args.input) die("render requires --in");
  if (!["md", "json", "both"].includes(args.format)) die("--format must be md|json|both");

  const review = await readJson(args.input);
  validateMergeReview(review, args.strict);
  const evidence = [];
  for (const p of args.evidence) {
    const parsed = await readJson(p);
    evidence.push(validateEvidenceArtifact(parsed, args.strict));
  }
  // Evidence ordering is frozen by (v,digest), independent of CLI input order.
  evidence.sort((a, b) => {
    if (a.v !== b.v) return a.v.localeCompare(b.v);
    return a.digest.localeCompare(b.digest);
  });

  const summary = buildSummaryJson(review, evidence);
  const md = buildMarkdown(summary);

  if (args.format === "md" || args.format === "both") {
    if (args.outMd) await writeUtf8(args.outMd, md);
    else process.stdout.write(md);
  }

  if (args.format === "json" || args.format === "both") {
    const payload = canonicalJson(summary);
    if (args.outJson) await writeUtf8(args.outJson, payload);
    else process.stdout.write(payload);
  }

  console.log(`ok mv-merge-review-render render digest=${summary.digest}`);
}

main().catch((err) => die(err.message || String(err)));
