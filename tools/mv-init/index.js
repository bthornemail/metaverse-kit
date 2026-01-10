#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";

function parseArgs(argv) {
  const out = { space: "demo", world: "world" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--space" && argv[i + 1]) out.space = argv[++i];
    if (arg === "--world" && argv[i + 1]) out.world = argv[++i];
  }
  return out;
}

async function ensureFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, content, "utf8");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const worldDir = path.resolve(process.cwd(), args.world);
  const spaceDir = path.join(worldDir, "spaces", args.space, "tiles", "z0/x0/y0");

  await fs.mkdir(spaceDir, { recursive: true });
  await ensureFile(path.join(spaceDir, "index.json"), "{}\n");
  await ensureFile(path.join(spaceDir, "manifest.json"), JSON.stringify({ tile_id: "z0/x0/y0", segments: [] }, null, 2) + "\n");

  await ensureFile(
    path.join(worldDir, ".ulp-root"),
    "invariants:\n  - adjacency\n  - exclusion\n  - consistency\n  - boundary_discipline\n  - authority_nontransfer\nscope:\n  realm: team\n  authority: source\n  boundary: interior\n"
  );
  await ensureFile(path.join(worldDir, ".ulp-scope"), "scope:\n  realm: team\n  authority: source\n  boundary: interior\n");
  await ensureFile(path.join(worldDir, ".ulp-ignore"), "node_modules\n.DS_Store\n");

  console.log(`Initialized world at ${worldDir}`);
  console.log(`Space: ${args.space}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
