#!/usr/bin/env node
import { spawn } from "child_process";
import path from "path";

function parseArgs(argv) {
  const out = { world: "world" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--world" && argv[i + 1]) out.world = argv[++i];
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const worldDir = path.resolve(process.cwd(), args.world);

  const child = spawn("npm", ["run", "dev", "--workspace", "apps/server"], {
    stdio: "inherit",
    env: { ...process.env, WORLD: worldDir },
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}

main();
