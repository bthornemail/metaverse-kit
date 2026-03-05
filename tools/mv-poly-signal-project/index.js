#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import {
  NORM_ID,
  canonicalJson,
  die,
  keyset,
  parsePolyCanonical,
  renderPolyFromMasks,
  requireSha,
  requireStringMembrane,
  shaPref,
} from "../wave28-poly-lib.js";

function parseArgs(argv) {
  const out = { mode: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "project") out.mode = "project";
    else if (a === "validate") out.mode = "validate";
    else if (a === "--pointer-trace" && argv[i + 1]) out.pointerTrace = argv[++i];
    else if (a === "--txrx" && argv[i + 1]) out.txrx = argv[++i];
    else if (a === "--poly-decomp" && argv[i + 1]) out.polyDecomp = argv[++i];
    else if (a === "--out-log" && argv[i + 1]) out.outLog = argv[++i];
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

async function readNdjson(p) {
  const raw = await fs.readFile(path.resolve(process.cwd(), p), "utf8");
  if (!raw.endsWith("\n")) die("input NDJSON must end with newline");
  return raw.trimEnd().split("\n").map((line, i) => {
    try { return JSON.parse(line); } catch { die(`invalid NDJSON line ${i + 1}`); }
  });
}

async function writeJson(p, obj) {
  await fs.writeFile(path.resolve(process.cwd(), p), canonicalJson(obj), "utf8");
}

async function writeNdjson(p, obj) {
  await fs.writeFile(path.resolve(process.cwd(), p), canonicalJson(obj), "utf8");
}

function maskFromPointer(pAfter) {
  const n = Number(pAfter);
  if (!Number.isInteger(n) || n < 0 || n > 239) die("pointer trace p_after out of range");
  return n % 64;
}

function maskFromBits(bits) {
  if (typeof bits !== "string" || !/^[01]{6}$/.test(bits)) die("txrx bits must be 6-bit string");
  return Number.parseInt(bits, 2);
}

function toParityMaskSet(masks) {
  const counts = new Map();
  for (const m of masks) counts.set(m, (counts.get(m) || 0) ^ 1);
  return [...counts.entries()].filter(([, bit]) => bit === 1).map(([m]) => m);
}

function validateProjectionArtifact(x) {
  keyset(x, ["authority", "digest", "input_poly", "norm_id", "poly_decomp_digest", "source_digest", "source_type", "v"], "signal_poly_projection");
  if (x.v !== "wave28.signal_poly_projection.v0") die("signal_poly_projection version mismatch");
  if (x.authority !== "advisory") die("signal_poly_projection authority must be advisory");
  if (x.source_type !== "pointer_sync" && x.source_type !== "txrx") die("signal_poly_projection source_type invalid");
  requireSha(x.source_digest, "signal_poly_projection.source_digest");
  if (x.poly_decomp_digest !== "" ) requireSha(x.poly_decomp_digest, "signal_poly_projection.poly_decomp_digest");
  requireSha(x.digest, "signal_poly_projection.digest");
  if (x.norm_id !== NORM_ID) die("signal_poly_projection norm_id mismatch");
  parsePolyCanonical(x.input_poly, "signal_poly_projection.input_poly");
  requireStringMembrane(x, "signal_poly_projection");

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
  if (want !== x.digest) die("signal_poly_projection digest mismatch");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.mode) {
    console.log("mv-poly-signal-project project (--pointer-trace <trace.ndjson> | --txrx <txrx.ndjson>) [--poly-decomp <poly-decomp.json>] --out <signal-poly.json> [--out-log <signal-poly.ndjson>]");
    console.log("mv-poly-signal-project validate --in <signal-poly.json>");
    return;
  }

  if (args.mode === "project") {
    if (!args.out) die("project requires --out");
    if ((args.pointerTrace ? 1 : 0) + (args.txrx ? 1 : 0) !== 1) {
      die("project requires exactly one source: --pointer-trace or --txrx");
    }

    let masks = [];
    let sourceDigest = "";
    let sourceType = "";

    if (args.pointerTrace) {
      const rows = await readNdjson(args.pointerTrace);
      masks = rows.map((r) => maskFromPointer(r.p_after));
      sourceType = "pointer_sync";
      sourceDigest = shaPref(Buffer.from(rows.map((r) => canonicalJson(r)).join(""), "utf8"));
    } else {
      const rows = await readNdjson(args.txrx);
      masks = rows.map((r) => maskFromBits(r.bits));
      sourceType = "txrx";
      sourceDigest = shaPref(Buffer.from(rows.map((r) => canonicalJson(r)).join(""), "utf8"));
    }

    let polyDecompDigest = "";
    if (args.polyDecomp) {
      const decomp = await readJson(args.polyDecomp);
      requireSha(decomp.digest, "poly_decomp.digest");
      polyDecompDigest = decomp.digest;
    }

    const inputPoly = renderPolyFromMasks(toParityMaskSet(masks));
    const body = {
      authority: "advisory",
      input_poly: inputPoly,
      norm_id: NORM_ID,
      poly_decomp_digest: polyDecompDigest,
      source_digest: sourceDigest,
      source_type: sourceType,
      v: "wave28.signal_poly_projection.v0",
    };
    const out = {
      ...body,
      digest: shaPref(Buffer.from(canonicalJson(body), "utf8")),
    };
    validateProjectionArtifact(out);
    await writeJson(args.out, out);
    if (args.outLog) {
      await writeNdjson(args.outLog, out);
    }
    console.log(`ok mv-poly-signal-project project digest=${out.digest}`);
    return;
  }

  if (args.mode === "validate") {
    if (!args.input) die("validate requires --in");
    const x = await readJson(args.input);
    validateProjectionArtifact(x);
    console.log(`ok mv-poly-signal-project validate digest=${x.digest}`);
    return;
  }

  die("mode must be project|validate");
}

main().catch((e) => die(e.message || String(e)));
