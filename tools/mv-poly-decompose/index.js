#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import {
  DECOMPOSE_ID,
  NORM_ID,
  canonicalJson,
  die,
  keyset,
  parsePolyCanonical,
  renderPolyFromMasks,
  requireSha,
  requireStringMembrane,
  shaPref,
  validateBasisArtifact,
} from "../wave28-poly-lib.js";

function parseArgs(argv) {
  const out = { mode: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "run") out.mode = "run";
    else if (a === "validate") out.mode = "validate";
    else if (a === "--basis" && argv[i + 1]) out.basis = argv[++i];
    else if (a === "--closed" && argv[i + 1]) out.closed = argv[++i];
    else if (a === "--poly" && argv[i + 1]) out.poly = argv[++i];
    else if (a === "--in" && argv[i + 1]) out.input = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
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

function validateClosedDigestReference(closed) {
  keyset(closed, ["authority", "basis_digest", "carrier_state_digest", "constraints_digest", "digest", "matrix_digest", "matrix_layout_id", "non_degenerate", "v"], "closed_config_ref");
  if (closed.v !== "wave28.closed_config.v0") die("closed_config_ref version mismatch");
  if (closed.authority !== "advisory") die("closed_config_ref authority must be advisory");
  requireSha(closed.digest, "closed_config_ref.digest");
  requireSha(closed.basis_digest, "closed_config_ref.basis_digest");
}

function decompose(inputPoly, basisMasks) {
  const inputMasks = parsePolyCanonical(inputPoly, "input_poly");
  const basisSet = new Set(basisMasks);
  const inputSet = new Set(inputMasks);
  const coeffVector = basisMasks.map((m) => (inputSet.has(m) ? "1" : "0"));
  const residualMasks = [...inputSet].filter((m) => !basisSet.has(m));
  return {
    coeffVector,
    residualPoly: renderPolyFromMasks(residualMasks),
  };
}

function validateDecompArtifact(x, basisDigest, closedDigest, basisMasks) {
  keyset(x, ["authority", "basis_digest", "closed_config_digest", "coeff_vector", "digest", "input_poly", "norm_id", "residual_poly", "v"], "poly_decomp");
  if (x.v !== "wave28.poly_decomp.v0") die("poly_decomp version mismatch");
  if (x.authority !== "advisory") die("poly_decomp authority must be advisory");
  if (x.basis_digest !== basisDigest) die("poly_decomp basis_digest mismatch");
  if (x.closed_config_digest !== closedDigest) die("poly_decomp closed_config_digest mismatch");
  if (x.norm_id !== NORM_ID) die("poly_decomp norm_id mismatch");
  requireSha(x.basis_digest, "poly_decomp.basis_digest");
  requireSha(x.closed_config_digest, "poly_decomp.closed_config_digest");
  requireSha(x.digest, "poly_decomp.digest");

  parsePolyCanonical(x.input_poly, "poly_decomp.input_poly");
  parsePolyCanonical(x.residual_poly, "poly_decomp.residual_poly");
  if (!Array.isArray(x.coeff_vector) || x.coeff_vector.length !== basisMasks.length) {
    die("poly_decomp.coeff_vector length mismatch");
  }
  x.coeff_vector.forEach((v, i) => {
    if (v !== "0" && v !== "1") die(`poly_decomp.coeff_vector[${i}] invalid`);
  });

  const replay = decompose(x.input_poly, basisMasks);
  if (JSON.stringify(replay.coeffVector) !== JSON.stringify(x.coeff_vector)) {
    die(`poly_decomp replay mismatch (${DECOMPOSE_ID}): coeff_vector`);
  }
  if (replay.residualPoly !== x.residual_poly) {
    die(`poly_decomp replay mismatch (${DECOMPOSE_ID}): residual_poly`);
  }

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-poly-decompose run --basis <basis.json> --closed <closed.json> --poly '<canonical-poly>' --out <poly-decomp.json>");
    console.log("mv-poly-decompose validate --in <poly-decomp.json> --basis <basis.json> --closed <closed.json>");
    return;
  }

  if (args.mode === "run") {
    if (!args.basis || !args.closed || !args.poly || !args.out) die("run requires --basis --closed --poly --out");
    const basis = await readJson(args.basis);
    const closed = await readJson(args.closed);
    const { basisMasks } = validateBasisArtifact(basis);
    validateClosedDigestReference(closed);
    if (closed.basis_digest !== basis.digest) die("closed_config basis_digest mismatch vs basis");

    const outCalc = decompose(args.poly, basisMasks);
    const body = {
      authority: "advisory",
      basis_digest: basis.digest,
      closed_config_digest: closed.digest,
      coeff_vector: outCalc.coeffVector,
      input_poly: args.poly,
      norm_id: NORM_ID,
      residual_poly: outCalc.residualPoly,
      v: "wave28.poly_decomp.v0",
    };
    const out = {
      ...body,
      digest: shaPref(Buffer.from(canonicalJson(body), "utf8")),
    };
    validateDecompArtifact(out, basis.digest, closed.digest, basisMasks);
    await writeJson(args.out, out);
    console.log(`ok mv-poly-decompose run digest=${out.digest} decompose_id=${DECOMPOSE_ID}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.input || !args.basis || !args.closed) die("validate requires --in --basis --closed");
    const basis = await readJson(args.basis);
    const closed = await readJson(args.closed);
    const x = await readJson(args.input);
    const { basisMasks } = validateBasisArtifact(basis);
    validateClosedDigestReference(closed);
    validateDecompArtifact(x, basis.digest, closed.digest, basisMasks);
    console.log(`ok mv-poly-decompose validate digest=${x.digest} decompose_id=${DECOMPOSE_ID}`);
    return;
  }

  die("mode must be run|validate");
}

main().catch((e) => die(e.message || String(e)));
