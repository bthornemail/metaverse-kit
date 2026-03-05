#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import {
  canonicalJson,
  die,
  keyset,
  maskToBitString,
  parseMonomial,
  parsePolyCanonical,
  renderMonomial,
  requireSha,
  requireStringMembrane,
  shaPref,
} from "../wave28-poly-lib.js";

const PLAN_MAP_ID = "wave29.plan_map.poly_to_wave20.v0";
const PLAN_NORM_ID = "wave29.plan_norm.step_lex.v0";
const PLAN_V = "wave29.action_plan.v0";

const INPUT_TYPES = new Set([
  "wave28.signal_poly_projection.v0",
  "wave28.poly_decomp.v0",
  "wave17.merge_review.v0",
  "wave27.pointer_sync_residual.v0",
]);

function parseArgs(argv) {
  const out = { mode: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "build") out.mode = "build";
    else if (a === "verify") out.mode = "verify";
    else if (a === "--projection" && argv[i + 1]) out.projection = argv[++i];
    else if (a === "--decomp" && argv[i + 1]) out.decomp = argv[++i];
    else if (a === "--merge-review" && argv[i + 1]) out.mergeReview = argv[++i];
    else if (a === "--residual" && argv[i + 1]) out.residual = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--in" && argv[i + 1]) out.input = argv[++i];
    else if (a === "--help" || a === "-h") out.help = "1";
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

function requireSortedInputs(inputs) {
  const sorted = [...inputs].sort((a, b) => (a.v === b.v ? a.digest.localeCompare(b.digest) : a.v.localeCompare(b.v)));
  if (JSON.stringify(inputs) !== JSON.stringify(sorted)) die("action_plan inputs not sorted by v,digest");
}

function requireSortedNotes(notes) {
  const sorted = [...notes].sort((a, b) => a.code.localeCompare(b.code));
  if (JSON.stringify(notes) !== JSON.stringify(sorted)) die("action_plan notes not sorted by code");
}

function parseStep(step, ctx) {
  if (typeof step !== "string" || !/^[1-9][0-9]*$/.test(step)) die(`${ctx} invalid step`);
  return Number(step);
}

function popcount(mask) {
  let n = mask;
  let c = 0;
  while (n) {
    c += n & 1;
    n >>= 1;
  }
  return c;
}

function validateProjection(x) {
  keyset(x, ["authority", "digest", "input_poly", "norm_id", "poly_decomp_digest", "source_digest", "source_type", "v"], "projection");
  if (x.v !== "wave28.signal_poly_projection.v0") die("projection version mismatch");
  if (x.authority !== "advisory") die("projection authority must be advisory");
  requireSha(x.digest, "projection.digest");
  requireSha(x.source_digest, "projection.source_digest");
  if (x.poly_decomp_digest !== "") requireSha(x.poly_decomp_digest, "projection.poly_decomp_digest");
  parsePolyCanonical(x.input_poly, "projection.input_poly");
  requireStringMembrane(x, "projection");
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
  if (want !== x.digest) die("projection digest mismatch");
}

function validateDecomp(x) {
  keyset(x, ["authority", "basis_digest", "closed_config_digest", "coeff_vector", "digest", "input_poly", "norm_id", "residual_poly", "v"], "poly_decomp");
  if (x.v !== "wave28.poly_decomp.v0") die("poly_decomp version mismatch");
  if (x.authority !== "advisory") die("poly_decomp authority must be advisory");
  requireSha(x.digest, "poly_decomp.digest");
  requireSha(x.basis_digest, "poly_decomp.basis_digest");
  requireSha(x.closed_config_digest, "poly_decomp.closed_config_digest");
  if (!Array.isArray(x.coeff_vector) || x.coeff_vector.some((v) => v !== "0" && v !== "1")) die("poly_decomp coeff_vector invalid");
  parsePolyCanonical(x.input_poly, "poly_decomp.input_poly");
  parsePolyCanonical(x.residual_poly, "poly_decomp.residual_poly");
  requireStringMembrane(x, "poly_decomp");
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
  if (want !== x.digest) die("poly_decomp digest mismatch");
}

function validateMergeReview(x) {
  keyset(x, ["authority", "bundle_digest", "digest", "groups", "render_hints", "summary", "v"], "merge_review");
  if (x.v !== "wave17.merge_review.v0") die("merge_review version mismatch");
  if (x.authority !== "advisory") die("merge_review authority must be advisory");
  requireSha(x.digest, "merge_review.digest");
  requireSha(x.bundle_digest, "merge_review.bundle_digest");
  requireStringMembrane(x, "merge_review");
  const body = {
    authority: x.authority,
    bundle_digest: x.bundle_digest,
    groups: x.groups,
    render_hints: x.render_hints,
    summary: x.summary,
    v: x.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== x.digest) die("merge_review digest mismatch");
}

function validateResidual(x) {
  keyset(x, ["authority", "candidate_a", "candidate_b", "digest", "fail_k", "p_before", "reflect_id", "ring_fingerprint", "turn_clock_id", "turn_project_id", "v"], "residual");
  if (x.v !== "wave27.pointer_sync_residual.v0") die("residual version mismatch");
  if (x.authority !== "advisory") die("residual authority must be advisory");
  requireSha(x.digest, "residual.digest");
  requireSha(x.ring_fingerprint, "residual.ring_fingerprint");
  requireStringMembrane(x, "residual");
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
  if (want !== x.digest) die("residual digest mismatch");
}

function derivePlanArtifacts({ projection, decomp, mergeReview, residual }) {
  validateProjection(projection);
  if (decomp) validateDecomp(decomp);
  if (mergeReview) validateMergeReview(mergeReview);
  if (residual) validateResidual(residual);

  const terms = parsePolyCanonical(projection.input_poly, "projection.input_poly");
  const baseEvidence = [{ role: "projection", digest: projection.digest }];
  if (decomp) baseEvidence.push({ role: "poly_decomp", digest: decomp.digest });
  if (mergeReview) baseEvidence.push({ role: "merge_review", digest: mergeReview.digest });
  if (residual) baseEvidence.push({ role: "pointer_residual", digest: residual.digest });
  const evidence = baseEvidence
    .map((e) => ({ digest: e.digest, role: e.role }))
    .sort((a, b) => (a.role === b.role ? a.digest.localeCompare(b.digest) : a.role.localeCompare(b.role)));

  const actions = terms.map((mask, idx) => {
    const degree = popcount(mask);
    const target = renderMonomial(mask);
    return {
      step: String(idx + 1),
      verb: degree >= 3 ? "TRACE_LINEAGE" : "FOCUS_CLUSTER",
      params: {
        bitmask: maskToBitString(mask),
        degree: String(degree),
        source_poly: projection.input_poly,
        target,
      },
      evidence,
    };
  });

  const notes = [];
  if (mergeReview && Number(mergeReview.summary?.conflict_count || "0") > 0) {
    notes.push({ code: "merge_review_conflicts", detail: `conflict_count=${mergeReview.summary.conflict_count}` });
  }
  if (decomp && decomp.residual_poly !== "0") {
    notes.push({ code: "poly_residual_nonzero", detail: `residual_poly=${decomp.residual_poly}` });
  }
  if (residual) {
    notes.push({ code: "pointer_residual_present", detail: `fail_k=${residual.fail_k}` });
  }
  notes.sort((a, b) => a.code.localeCompare(b.code));

  const inputs = [
    { v: projection.v, digest: projection.digest },
    ...(decomp ? [{ v: decomp.v, digest: decomp.digest }] : []),
    ...(mergeReview ? [{ v: mergeReview.v, digest: mergeReview.digest }] : []),
    ...(residual ? [{ v: residual.v, digest: residual.digest }] : []),
  ].sort((a, b) => (a.v === b.v ? a.digest.localeCompare(b.digest) : a.v.localeCompare(b.v)));

  return {
    authority: "advisory",
    plan_map_id: PLAN_MAP_ID,
    plan_norm_id: PLAN_NORM_ID,
    inputs,
    actions,
    notes,
    v: PLAN_V,
  };
}

function validatePlanSchema(plan) {
  keyset(plan, ["actions", "authority", "digest", "inputs", "notes", "plan_map_id", "plan_norm_id", "v"], "action_plan");
  if (plan.v !== PLAN_V) die("action_plan version mismatch");
  if (plan.authority !== "advisory") die("action_plan authority must be advisory");
  if (plan.plan_map_id !== PLAN_MAP_ID) die("action_plan plan_map_id mismatch");
  if (plan.plan_norm_id !== PLAN_NORM_ID) die("action_plan plan_norm_id mismatch");
  requireSha(plan.digest, "action_plan.digest");

  if (!Array.isArray(plan.inputs) || plan.inputs.length === 0) die("action_plan inputs must be non-empty array");
  plan.inputs.forEach((x, i) => {
    keyset(x, ["digest", "v"], `inputs[${i}]`);
    if (!INPUT_TYPES.has(x.v)) die(`inputs[${i}] v invalid`);
    requireSha(x.digest, `inputs[${i}].digest`);
  });
  requireSortedInputs(plan.inputs);

  if (!Array.isArray(plan.actions) || plan.actions.length === 0) die("action_plan actions must be non-empty array");
  let expectStep = 1;
  for (let i = 0; i < plan.actions.length; i++) {
    const a = plan.actions[i];
    keyset(a, ["evidence", "params", "step", "verb"], `actions[${i}]`);
    const step = parseStep(a.step, `actions[${i}].step`);
    if (step !== expectStep) die("action_plan step sequence mismatch");
    expectStep += 1;
    if (a.verb !== "FOCUS_CLUSTER" && a.verb !== "TRACE_LINEAGE") die(`actions[${i}].verb invalid`);
    keyset(a.params, ["bitmask", "degree", "source_poly", "target"], `actions[${i}].params`);
    if (!/^[01]{6}$/.test(a.params.bitmask)) die(`actions[${i}].params.bitmask invalid`);
    if (!/^[1-6]$/.test(a.params.degree)) die(`actions[${i}].params.degree invalid`);
    parsePolyCanonical(a.params.source_poly, `actions[${i}].params.source_poly`);
    parseMonomial(a.params.target, `actions[${i}].params.target`);
    if (!Array.isArray(a.evidence) || a.evidence.length === 0) die(`actions[${i}].evidence must be non-empty array`);
    for (let j = 0; j < a.evidence.length; j++) {
      const e = a.evidence[j];
      keyset(e, ["digest", "role"], `actions[${i}].evidence[${j}]`);
      requireSha(e.digest, `actions[${i}].evidence[${j}].digest`);
      if (typeof e.role !== "string" || e.role.length === 0) die(`actions[${i}].evidence[${j}].role invalid`);
    }
    const sortedEvidence = [...a.evidence].sort((x, y) => (x.role === y.role ? x.digest.localeCompare(y.digest) : x.role.localeCompare(y.role)));
    if (JSON.stringify(sortedEvidence) !== JSON.stringify(a.evidence)) die(`actions[${i}].evidence not sorted`);
  }

  if (!Array.isArray(plan.notes)) die("action_plan notes must be array");
  plan.notes.forEach((n, i) => {
    keyset(n, ["code", "detail"], `notes[${i}]`);
    if (typeof n.code !== "string" || n.code.length === 0) die(`notes[${i}].code invalid`);
    if (typeof n.detail !== "string" || n.detail.length === 0) die(`notes[${i}].detail invalid`);
  });
  requireSortedNotes(plan.notes);

  requireStringMembrane(plan, "action_plan");

  const body = {
    actions: plan.actions,
    authority: plan.authority,
    inputs: plan.inputs,
    notes: plan.notes,
    plan_map_id: plan.plan_map_id,
    plan_norm_id: plan.plan_norm_id,
    v: plan.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== plan.digest) die("action_plan digest mismatch");
}

function buildOutput(body) {
  return {
    ...body,
    digest: shaPref(Buffer.from(canonicalJson(body), "utf8")),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-action-plan build --projection <signal-projection.json> [--decomp <poly-decomp.json>] [--merge-review <merge-review.json>] [--residual <residual.json>] --out <action-plan.json>");
    console.log("mv-action-plan verify --in <action-plan.json> --projection <signal-projection.json> [--decomp <poly-decomp.json>] [--merge-review <merge-review.json>] [--residual <residual.json>]");
    return;
  }

  if (args.mode === "build") {
    if (!args.projection || !args.out) die("build requires --projection --out");
    const projection = await readJson(args.projection);
    const decomp = args.decomp ? await readJson(args.decomp) : null;
    const mergeReview = args.mergeReview ? await readJson(args.mergeReview) : null;
    const residual = args.residual ? await readJson(args.residual) : null;

    const body = derivePlanArtifacts({ projection, decomp, mergeReview, residual });
    const out = buildOutput(body);
    validatePlanSchema(out);
    await writeJson(args.out, out);
    console.log(`ok mv-action-plan build digest=${out.digest}`);
    return;
  }

  if (args.mode === "verify") {
    if (!args.input || !args.projection) die("verify requires --in --projection");
    const projection = await readJson(args.projection);
    const decomp = args.decomp ? await readJson(args.decomp) : null;
    const mergeReview = args.mergeReview ? await readJson(args.mergeReview) : null;
    const residual = args.residual ? await readJson(args.residual) : null;
    const plan = await readJson(args.input);

    validatePlanSchema(plan);

    const expectedBody = derivePlanArtifacts({ projection, decomp, mergeReview, residual });
    const expected = buildOutput(expectedBody);

    if (canonicalJson(plan) !== canonicalJson(expected)) {
      die("action_plan recompute mismatch");
    }

    console.log(`ok mv-action-plan verify digest=${plan.digest}`);
    return;
  }

  die("mode must be build|verify");
}

main().catch((e) => die(e.message || String(e)));
