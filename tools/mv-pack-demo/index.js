#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

function parseArgs(argv) {
  const out = {
    out: "demo.bundle",
    includePortal: "0",
    entityModels: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--story" && argv[i + 1]) out.story = argv[++i];
    else if (a === "--narrative-state" && argv[i + 1]) out.narrativeState = argv[++i];
    else if (a === "--world" && argv[i + 1]) out.world = argv[++i];
    else if (a === "--events" && argv[i + 1]) out.events = argv[++i];
    else if (a === "--multiview" && argv[i + 1]) out.multiview = argv[++i];
    else if (a === "--harmonic" && argv[i + 1]) out.harmonic = argv[++i];
    else if (a === "--observer-profile" && argv[i + 1]) out.observerProfile = argv[++i];
    else if (a === "--world-entities" && argv[i + 1]) out.worldEntities = argv[++i];
    else if (a === "--world-graph" && argv[i + 1]) out.worldGraph = argv[++i];
    else if (a === "--behavior-grammar" && argv[i + 1]) out.behaviorGrammar = argv[++i];
    else if (a === "--entity-model" && argv[i + 1]) out.entityModels.push(argv[++i]);
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--include-portal") out.includePortal = "1";
    else if (a === "--force") out.force = "1";
    else if (a === "--help" || a === "-h") out.help = "1";
    else throw new Error(`unknown arg: ${a}`);
  }
  return out;
}

function help() {
  return [
    "mv-pack-demo --story <file> --world <file> --events <file> --multiview <file> --harmonic <file> --observer-profile <file> [--world-entities <file>] [--world-graph <file>] [--behavior-grammar <file>] [--entity-model <file>] [--out demo.bundle] [--include-portal] [--force]",
    "",
    "Deterministic demo bundle packager (projection-only).",
  ].join("\n");
}

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sha256Pref(bytes) {
  return `sha256:${sha256Hex(bytes)}`;
}

function canonicalJson(obj) {
  return `${JSON.stringify(obj, Object.keys(obj).sort(), 0)}\n`;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalJsonDeep(obj) {
  return `${stableStringify(obj)}\n`;
}

async function ensureCleanOut(outDir, force) {
  try {
    await fs.access(outDir);
    if (force !== "1") {
      throw new Error(`output exists: ${outDir} (use --force)`);
    }
    await fs.rm(outDir, { recursive: true, force: true });
  } catch (err) {
    if (err.code === "ENOENT") return;
    if (String(err.message || err).includes("output exists:")) throw err;
  }
}

async function readArtifact(inputPath) {
  const abs = path.resolve(process.cwd(), inputPath);
  const raw = await fs.readFile(abs);
  return { abs, raw };
}

async function writeBytes(filePath, bytes) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
}

async function copyPortalAssets(portalOutDir) {
  const portalDir = path.resolve(process.cwd(), "portal");
  const names = ["index.html", "verify.js", "render.js", "runtime.js", "narrative-mode.js", "entity-scene-adapter.js", "world-relations-adapter.js", "world-behavior-adapter.js", "styles.css"];
  for (const name of names) {
    const src = path.join(portalDir, name);
    const dst = path.join(portalOutDir, name);
    const bytes = await fs.readFile(src);
    await writeBytes(dst, bytes);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1") {
    console.log(help());
    return;
  }

  const required = ["story", "world", "events", "multiview", "harmonic", "observerProfile"];
  for (const key of required) {
    if (!args[key]) throw new Error(`missing --${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`);
  }

  const outDir = path.resolve(process.cwd(), args.out);
  await ensureCleanOut(outDir, args.force);

  const bundleAssets = [
    { role: "story", src: args.story, dst: "canonical/story_bundle.json" },
    { role: "world", src: args.world, dst: "canonical/civic_world_graph.json" },
    { role: "events", src: args.events, dst: "canonical/civic_event_log.ndjson" },
    { role: "multiview", src: args.multiview, dst: "canonical/multiview_manifest.json" },
    { role: "harmonic", src: args.harmonic, dst: "canonical/harmonic.ndjson" },
    { role: "observer_profile", src: args.observerProfile, dst: "canonical/observer_profile.json" },
  ];

  if (args.narrativeState) {
    bundleAssets.push({ role: "narrative_state", src: args.narrativeState, dst: "canonical/narrative_state.json" });
  }
  if (args.worldEntities) {
    bundleAssets.push({ role: "world_entities", src: args.worldEntities, dst: "canonical/world_entities.json" });
  }
  if (args.worldGraph) {
    bundleAssets.push({ role: "world_graph", src: args.worldGraph, dst: "canonical/world_graph.json" });
  }
  if (args.behaviorGrammar) {
    bundleAssets.push({ role: "behavior_grammar", src: args.behaviorGrammar, dst: "canonical/behavior_grammar.json" });
  }
  for (let i = 0; i < args.entityModels.length; i++) {
    bundleAssets.push({
      role: "entity_model",
      src: args.entityModels[i],
      dst: `canonical/entity_model_${String(i).padStart(2, "0")}.json`,
    });
  }

  const files = [];
  for (const item of bundleAssets) {
    const { raw } = await readArtifact(item.src);
    const dstAbs = path.join(outDir, item.dst);
    await writeBytes(dstAbs, raw);
    files.push({
      bytes: String(raw.byteLength),
      path: item.dst,
      role: item.role,
      sha256: sha256Pref(raw),
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  const manifestPayload = {
    files,
    policy: {
      allow_authority_mutation: "0",
      allow_network_fetch: "0",
      allow_nondeterminism: "0",
    },
    summary: {
      file_count: String(files.length),
    },
    v: "wave14.demo_bundle.v0",
  };

  const manifestDigest = sha256Pref(Buffer.from(canonicalJsonDeep(manifestPayload), "utf8"));
  const manifest = {
    ...manifestPayload,
    bundle_digest: manifestDigest,
  };

  const manifestBytes = Buffer.from(canonicalJsonDeep(manifest), "utf8");
  await writeBytes(path.join(outDir, "manifest.json"), manifestBytes);
  const integrityBytes = Buffer.from(`${sha256Pref(manifestBytes)}\n`, "utf8");
  await writeBytes(path.join(outDir, "integrity.sha256"), integrityBytes);

  if (args.includePortal === "1") {
    await copyPortalAssets(path.join(outDir, "portal"));
  }

  console.log(`ok mv-pack-demo bundle=${outDir} digest=${sha256Pref(manifestBytes)}`);
}

main().catch((err) => {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(2);
});
