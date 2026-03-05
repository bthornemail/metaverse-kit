#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import {
  MATRIX_LAYOUT_ID,
  canonicalJson,
  determinantNonZeroF2,
  die,
  keyset,
  requireBitString,
  requireSha,
  requireStringMembrane,
  rotateBits6,
  shaPref,
  validateBasisArtifact,
  validateCarrierArtifact,
  validateConstraintsArtifact,
  xorBits6,
} from "../wave28-poly-lib.js";

function parseArgs(argv) {
  const out = { mode: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "build") out.mode = "build";
    else if (a === "validate") out.mode = "validate";
    else if (a === "--basis" && argv[i + 1]) out.basis = argv[++i];
    else if (a === "--constraints" && argv[i + 1]) out.constraints = argv[++i];
    else if (a === "--carrier" && argv[i + 1]) out.carrier = argv[++i];
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

function buildMatrix(rows, carrierBits) {
  const outRows = [];
  for (let i = 0; i < 6; i++) {
    outRows.push(xorBits6(rows[i], rotateBits6(carrierBits, i)));
  }
  const matrix = {
    columns: ["x1", "x2", "x3", "x4", "x5", "x6"],
    layout: MATRIX_LAYOUT_ID,
    rows: outRows,
  };
  return { matrix, matrixDigest: shaPref(Buffer.from(canonicalJson(matrix), "utf8")) };
}

function validateClosed(closed, basisDigest) {
  keyset(closed, ["authority", "basis_digest", "carrier_state_digest", "constraints_digest", "digest", "matrix_digest", "matrix_layout_id", "non_degenerate", "v"], "closed_config");
  if (closed.v !== "wave28.closed_config.v0") die("closed_config version mismatch");
  if (closed.authority !== "advisory") die("closed_config authority must be advisory");
  if (closed.basis_digest !== basisDigest) die("closed_config basis_digest mismatch");
  requireSha(closed.basis_digest, "closed_config.basis_digest");
  requireSha(closed.constraints_digest, "closed_config.constraints_digest");
  requireSha(closed.carrier_state_digest, "closed_config.carrier_state_digest");
  requireSha(closed.matrix_digest, "closed_config.matrix_digest");
  requireSha(closed.digest, "closed_config.digest");
  if (closed.matrix_layout_id !== MATRIX_LAYOUT_ID) die("closed_config matrix_layout_id mismatch");
  requireBitString(closed.non_degenerate, "closed_config.non_degenerate");

  requireStringMembrane(closed, "closed_config");
  const body = {
    authority: closed.authority,
    basis_digest: closed.basis_digest,
    carrier_state_digest: closed.carrier_state_digest,
    constraints_digest: closed.constraints_digest,
    matrix_digest: closed.matrix_digest,
    matrix_layout_id: closed.matrix_layout_id,
    non_degenerate: closed.non_degenerate,
    v: closed.v,
  };
  const want = shaPref(Buffer.from(canonicalJson(body), "utf8"));
  if (want !== closed.digest) die("closed_config digest mismatch");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-poly-closed-config build --basis <basis.json> --constraints <constraints.json> --carrier <carrier.json> --out <closed.json>");
    console.log("mv-poly-closed-config validate --in <closed.json> --basis <basis.json>");
    return;
  }

  if (args.mode === "build") {
    if (!args.basis || !args.constraints || !args.carrier || !args.out) die("build requires --basis --constraints --carrier --out");
    const basis = await readJson(args.basis);
    const constraints = await readJson(args.constraints);
    const carrier = await readJson(args.carrier);

    validateBasisArtifact(basis);
    validateConstraintsArtifact(constraints);
    validateCarrierArtifact(carrier);

    const { matrix, matrixDigest } = buildMatrix(constraints.row_masks, carrier.carrier_bits);
    const nonDegenerate = determinantNonZeroF2(matrix.rows) ? "1" : "0";

    const body = {
      authority: "advisory",
      basis_digest: basis.digest,
      carrier_state_digest: carrier.digest,
      constraints_digest: constraints.digest,
      matrix_digest: matrixDigest,
      matrix_layout_id: MATRIX_LAYOUT_ID,
      non_degenerate: nonDegenerate,
      v: "wave28.closed_config.v0",
    };
    const out = {
      ...body,
      digest: shaPref(Buffer.from(canonicalJson(body), "utf8")),
    };
    validateClosed(out, basis.digest);
    await writeJson(args.out, out);
    console.log(`ok mv-poly-closed-config build digest=${out.digest} non_degenerate=${nonDegenerate}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.input || !args.basis) die("validate requires --in --basis");
    const basis = await readJson(args.basis);
    const closed = await readJson(args.input);
    validateBasisArtifact(basis);
    validateClosed(closed, basis.digest);
    console.log(`ok mv-poly-closed-config validate digest=${closed.digest}`);
    return;
  }

  die("mode must be build|validate");
}

main().catch((e) => die(e.message || String(e)));
