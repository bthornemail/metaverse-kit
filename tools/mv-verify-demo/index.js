#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function shaPref(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--bundle" && argv[i + 1]) out.bundle = argv[++i];
    else if (a === "--help" || a === "-h") out.help = "1";
    else die(`unknown arg: ${a}`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1" || !args.bundle) {
    console.log("mv-verify-demo --bundle <demo.bundle>");
    return;
  }

  const bundleDir = path.resolve(process.cwd(), args.bundle);
  const manifestPath = path.join(bundleDir, "manifest.json");
  const integrityPath = path.join(bundleDir, "integrity.sha256");

  const manifestBytes = await fs.readFile(manifestPath);
  const integrity = (await fs.readFile(integrityPath, "utf8")).trim();
  const gotManifestDigest = shaPref(manifestBytes);
  if (integrity !== gotManifestDigest) die(`manifest digest mismatch: expected ${integrity} got ${gotManifestDigest}`);

  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch (err) {
    die(`manifest parse failed: ${err.message || err}`);
  }
  if (!Array.isArray(manifest.files)) die("manifest.files must be array");

  for (const [idx, file] of manifest.files.entries()) {
    if (!file || typeof file !== "object") die(`manifest.files[${idx}] must be object`);
    const keys = Object.keys(file).sort().join(",");
    if (keys !== "bytes,path,role,sha256") die(`manifest.files[${idx}] keyset mismatch`);
    if (typeof file.path !== "string" || file.path.length === 0) die(`manifest.files[${idx}].path invalid`);
    if (typeof file.sha256 !== "string" || !/^sha256:[0-9a-f]{64}$/.test(file.sha256)) die(`manifest.files[${idx}].sha256 invalid`);
    if (typeof file.bytes !== "string" || !/^\d+$/.test(file.bytes)) die(`manifest.files[${idx}].bytes invalid`);
    const p = path.join(bundleDir, file.path);
    const b = await fs.readFile(p);
    const d = shaPref(b);
    if (d !== file.sha256) die(`asset digest mismatch: ${file.path}`);
    if (String(b.byteLength) !== file.bytes) die(`asset size mismatch: ${file.path}`);
  }

  console.log(`ok mv-verify-demo files=${manifest.files.length} digest=${gotManifestDigest}`);
}

main().catch((err) => die(err.message || String(err)));
