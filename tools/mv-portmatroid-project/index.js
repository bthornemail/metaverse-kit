#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";

function parseArgs(argv) {
  const out = {
    snapshot: "",
    snapshotJson: "",
    out: "",
    pmRoot: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--snapshot" && argv[i + 1]) out.snapshot = argv[++i];
    else if (a === "--snapshot-json" && argv[i + 1]) out.snapshotJson = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--pm-root" && argv[i + 1]) out.pmRoot = argv[++i];
  }
  return out;
}

function stableStringify(v) {
  if (v === null) return "null";
  const t = typeof v;
  if (t === "string") return JSON.stringify(v);
  if (t === "number" || t === "boolean") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  if (t === "object") {
    const ks = Object.keys(v).sort();
    return "{" + ks.map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
  }
  return JSON.stringify(String(v));
}

async function loadSnapshotJson(args) {
  if (args.snapshotJson) {
    const p = path.resolve(process.cwd(), args.snapshotJson);
    return JSON.parse(await fs.readFile(p, "utf8"));
  }
  if (args.snapshot) {
    const snap = path.resolve(process.cwd(), args.snapshot);
    const pmRoot = args.pmRoot
      ? path.resolve(process.cwd(), args.pmRoot)
      : path.resolve(process.cwd(), "..", "port-matroid");
    const cmd = `cd "${pmRoot}" && cabal -v0 run port-matroid-tool -- export-snapshot-json "${snap}"`;
    const res = spawnSync("bash", ["-lc", cmd], { encoding: "utf8" });
    if (res.status !== 0) {
      throw new Error(`port-matroid export failed: ${res.stderr || res.stdout || "unknown error"}`);
    }
    return JSON.parse(res.stdout);
  }
  throw new Error("usage: mv-portmatroid-project --snapshot <file.csnp> | --snapshot-json <file.json> [--out <file>]");
}

function project(snapshot) {
  const entities = Array.isArray(snapshot.entities) ? snapshot.entities : [];
  return {
    kind: "metaverse-kit.projector.port_matroid.v0",
    snapshot: {
      tick: snapshot.tick,
      hash_hex: snapshot.hash_hex,
      entity_count: snapshot.entity_count,
    },
    // Pure projection: deterministic mapping to a view-friendly structure.
    nodes: entities.map((e) => ({
      node_id: `ent:${String(e.eid)}`,
      etype: e.etype,
      components: e.components ?? {},
    })),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const snap = await loadSnapshotJson(args);
  const proj = project(snap);
  const outText = stableStringify(proj) + "\n";

  if (args.out) {
    const p = path.resolve(process.cwd(), args.out);
    await fs.writeFile(p, outText, "utf8");
    process.stdout.write(`Wrote projection to ${args.out}\n`);
  } else {
    process.stdout.write(outText);
  }
}

main().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : e) + "\n");
  process.exit(1);
});

