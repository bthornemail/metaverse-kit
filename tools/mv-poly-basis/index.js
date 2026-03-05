#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { canonicalJson, die, renderPolyFromMasks, shaPref, validateBasisArtifact } from "../wave28-poly-lib.js";

function parseArgs(argv) {
  const out = { mode: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "emit") out.mode = "emit";
    else if (a === "validate") out.mode = "validate";
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

function buildBasis() {
  const basisMasks = [1, 2, 4, 8, 16, 32];
  const basis = basisMasks.map((m) => renderPolyFromMasks([m]));
  const body = {
    authority: "advisory",
    basis,
    basis_order: basis,
    field: "F2",
    v: "wave28.zero_poly_basis.v0",
    variables: ["x1", "x2", "x3", "x4", "x5", "x6"],
  };
  return {
    ...body,
    digest: shaPref(Buffer.from(canonicalJson(body), "utf8")),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-poly-basis emit --out <zero-poly-basis.v0.json>");
    console.log("mv-poly-basis validate --in <zero-poly-basis.v0.json>");
    return;
  }

  if (args.mode === "emit") {
    if (!args.out) die("emit requires --out");
    const out = buildBasis();
    validateBasisArtifact(out);
    await writeJson(args.out, out);
    console.log(`ok mv-poly-basis emit digest=${out.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.input) die("validate requires --in");
    const basis = await readJson(args.input);
    validateBasisArtifact(basis);
    console.log(`ok mv-poly-basis validate digest=${basis.digest}`);
    return;
  }

  die("mode must be emit|validate");
}

main().catch((e) => die(e.message || String(e)));
