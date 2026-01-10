#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";

function parseArgs(argv) {
  const out = {
    world: "world",
    space: "demo",
    tile: "z0/x0/y0",
    out: "",
    after: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--world" && argv[i + 1]) out.world = argv[++i];
    if (arg === "--space" && argv[i + 1]) out.space = argv[++i];
    if (arg === "--tile" && argv[i + 1]) out.tile = argv[++i];
    if (arg === "--out" && argv[i + 1]) out.out = argv[++i];
    if (arg === "--after" && argv[i + 1]) out.after = argv[++i];
  }
  return out;
}

function objectPath(rootDir, hash) {
  const [algo, hex] = hash.split(":");
  return path.join(rootDir, "objects", algo, hex.slice(0, 2), hex.slice(2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const worldDir = path.resolve(process.cwd(), args.world);
  const manifestPath = path.join(
    worldDir,
    "spaces",
    args.space,
    "tiles",
    args.tile,
    "manifest.json"
  );

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  let segments = manifest.segments ?? [];

  if (args.after) {
    let include = false;
    const filtered = [];
    for (const seg of segments) {
      if (seg.from_event === args.after) {
        include = true;
        filtered.push(seg);
        continue;
      }
      if (include) filtered.push(seg);
      if (seg.to_event === args.after) include = true;
    }
    segments = filtered;
  }

  let output = "";
  for (const seg of segments) {
    const data = await fs.readFile(objectPath(worldDir, seg.hash), "utf8");
    output += data.trim() + "\n";
  }

  if (args.out) {
    await fs.writeFile(args.out, output, "utf8");
    console.log(`Wrote ${segments.length} segments to ${args.out}`);
  } else {
    process.stdout.write(output);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
