#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const VERSION = "wave16.narrative_state.v0";
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const ALLOWED_EXT = new Set([".md"]);
const DIALOGUE_ROLES = ["solon", "solomon", "asabiyyah", "metatron", "witness"];

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root" && argv[i + 1]) out.root = argv[++i];
    else if (a === "--series" && argv[i + 1]) out.series = argv[++i];
    else if (a === "--title" && argv[i + 1]) out.title = argv[++i];
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

function ensureStringMembrane(obj, ctx = "root") {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => ensureStringMembrane(v, `${ctx}[${i}]`));
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) ensureStringMembrane(v, `${ctx}.${k}`);
    return;
  }
  if (typeof obj !== "string") die(`${ctx} violates string membrane`);
}

function inferSection(relPath) {
  const first = relPath.split("/")[0];
  const lower = relPath.toLowerCase();
  if (first === "PRELUDE") return "prelude";
  if (first === "EPILOUGE" || first === "EPILOGUE") return "epilogue";
  if (first === "ASIDE.md" || lower === "aside.md") return "aside";
  if (/^ARTICLE [IVX]+\.md$/i.test(first) || /^article [ivx]+\.md$/i.test(first) || lower.startsWith("article ")) {
    return "article";
  }
  die(`section inference failed for path: ${relPath}`);
}

function inferStance(name) {
  const n = name.toLowerCase();
  if (n.includes("solon")) return "solon";
  if (n.includes("solomon")) return "solomon";
  if (n.includes("asabiyyah") || n.includes("asabiyah")) return "asabiyyah";
  if (n.includes("metatron")) return "metatron";
  if (n.includes("law")) return "solon";
  if (n.includes("wisdom")) return "solomon";
  if (n.includes("tribe")) return "asabiyyah";
  return "balance";
}

function inferTopology(section, stance) {
  if (section === "prelude") return "genesis_lattice";
  if (section === "aside") return "glossary_overlay";
  if (section === "epilogue") return "covenant_reflection";
  if (stance === "solon") return "constraint_grid";
  if (stance === "solomon") return "interpretive_manifold";
  if (stance === "asabiyyah") return "cohesion_cluster";
  if (stance === "metatron") return "observer_fractal";
  return "civic_forum";
}

function inferProjections(section) {
  return {
    ar: section === "epilogue" ? "enabled" : "optional",
    audio: "enabled",
    canvas2d: "enabled",
    inspector: "enabled",
    scene3d: "enabled",
    timeline: "enabled",
    vr: section === "epilogue" ? "enabled" : "optional",
  };
}

function keyset(obj, expected, ctx) {
  const got = Object.keys(obj).sort().join(",");
  const want = [...expected].sort().join(",");
  if (got !== want) die(`${ctx} keyset mismatch`);
}

async function collectFiles(rootAbs, rel = "") {
  const dir = path.join(rootAbs, rel);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const out = [];
  for (const entry of sorted) {
    if (entry.name.startsWith(".")) die(`hidden path not allowed: ${path.posix.join(rel, entry.name)}`);
    const entryRel = path.posix.join(rel, entry.name);
    const abs = path.join(rootAbs, entryRel);
    const st = await fs.lstat(abs);
    if (st.isSymbolicLink()) die(`symlink not allowed: ${entryRel}`);
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(rootAbs, entryRel)));
      continue;
    }
    if (!entry.isFile()) die(`unsupported entry type: ${entryRel}`);
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) die(`unsupported extension: ${entryRel}`);
    out.push(entryRel);
  }
  return out;
}

async function buildState(rootAbs, relPath) {
  if (relPath.includes("..") || path.isAbsolute(relPath)) die(`invalid path: ${relPath}`);
  const abs = path.join(rootAbs, relPath);
  const raw = await fs.readFile(abs);
  const txt = raw.toString("utf8");
  const lines = txt.split("\n");
  const words = txt.trim().length === 0 ? 0 : txt.trim().split(/\s+/u).length;
  const section = inferSection(relPath);
  const title = path.basename(relPath, ".md");
  const stance = inferStance(`${title}|${section}`);
  const topology = inferTopology(section, stance);
  const stateCore = {
    authority: "advisory",
    dialogue_roles: DIALOGUE_ROLES,
    id: shaPref(Buffer.from(relPath, "utf8")),
    projections: inferProjections(section),
    section,
    source_digest: shaPref(raw),
    source_path: relPath,
    stance,
    title,
    topology,
    transitions: [],
    word_count: String(words),
    line_count: String(lines.length),
  };
  ensureStringMembrane(stateCore, "state");
  const digest = shaPref(Buffer.from(canonicalJson(stateCore), "utf8"));
  return { ...stateCore, digest };
}

function withTransitions(states) {
  const byId = new Map(states.map((s) => [s.id, s]));
  for (let i = 0; i < states.length; i++) {
    const prev = i > 0 ? states[i - 1].id : "";
    const next = i < states.length - 1 ? states[i + 1].id : "";
    const s = states[i];
    const transitions = [prev, next].filter(Boolean);
    const core = {
      ...s,
      transitions,
    };
    delete core.digest;
    ensureStringMembrane(core, "state");
    const digest = shaPref(Buffer.from(canonicalJson(core), "utf8"));
    byId.set(s.id, { ...core, digest });
  }
  return states.map((s) => byId.get(s.id));
}

function validateState(s, idx) {
  keyset(
    s,
    [
      "authority",
      "dialogue_roles",
      "digest",
      "id",
      "line_count",
      "projections",
      "section",
      "source_digest",
      "source_path",
      "stance",
      "title",
      "topology",
      "transitions",
      "word_count",
    ],
    `states[${idx}]`
  );
  if (!SHA_RE.test(s.id)) die(`states[${idx}].id invalid`);
  if (!SHA_RE.test(s.source_digest)) die(`states[${idx}].source_digest invalid`);
  if (!SHA_RE.test(s.digest)) die(`states[${idx}].digest invalid`);
  if (!/^\d+$/.test(s.word_count) || !/^\d+$/.test(s.line_count)) die(`states[${idx}] count field invalid`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "1") {
    console.log(
      "mv-narrative-state-project --root <narrative-dir> [--series <name>] [--title <title>] [--out <file>]\n"
    );
    return;
  }
  if (!args.root) die("missing --root");
  const rootAbs = path.resolve(process.cwd(), args.root);
  const rootLabel = args.root.replace(/\\/g, "/").replace(/\/+$/, "");
  const stat = await fs.lstat(rootAbs).catch(() => null);
  if (!stat || !stat.isDirectory()) die(`root directory missing: ${rootAbs}`);

  const relFiles = (await collectFiles(rootAbs)).sort((a, b) => a.localeCompare(b));
  if (relFiles.length === 0) die("no narrative markdown files found");
  const states0 = [];
  for (const rel of relFiles) states0.push(await buildState(rootAbs, rel));
  const states = withTransitions(states0).sort((a, b) => a.source_path.localeCompare(b.source_path));
  states.forEach(validateState);

  const structure = {
    articles: states.filter((s) => s.section === "article").map((s) => s.id),
    aside: states.filter((s) => s.section === "aside").map((s) => s.id),
    epilogue: states.filter((s) => s.section === "epilogue").map((s) => s.id),
    prelude: states.filter((s) => s.section === "prelude").map((s) => s.id),
  };
  ensureStringMembrane(structure, "structure");

  const payload = {
    authority: "advisory",
    narrative_root: rootLabel,
    series: args.series || "When Wisdom, Law, and the Tribe Sat Down Together",
    structure,
    summary: {
      article_count: String(structure.articles.length),
      epilogue_count: String(structure.epilogue.length),
      prelude_count: String(structure.prelude.length),
      state_count: String(states.length),
    },
    title: args.title || "Narrative Portal Mode v0",
    v: VERSION,
    states,
  };
  ensureStringMembrane(payload, "payload");
  const digest = shaPref(Buffer.from(canonicalJson(payload), "utf8"));
  const model = { ...payload, digest };

  const out = Buffer.from(canonicalJson(model), "utf8");
  if (args.out) {
    const outAbs = path.resolve(process.cwd(), args.out);
    await fs.mkdir(path.dirname(outAbs), { recursive: true });
    await fs.writeFile(outAbs, out);
    console.error(`ok mv-narrative-state-project out=${args.out} digest=${digest}`);
    return;
  }
  process.stdout.write(out);
}

main().catch((err) => die(err.message || String(err)));
