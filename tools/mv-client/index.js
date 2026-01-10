#!/usr/bin/env node
import { spawnSync } from "child_process";

const url = process.argv[2] || "http://localhost:3000";

const platforms = [
  { cmd: "xdg-open", args: [url] },
  { cmd: "open", args: [url] },
  { cmd: "start", args: [url], shell: true },
];

let opened = false;
for (const p of platforms) {
  const res = spawnSync(p.cmd, p.args, { stdio: "ignore", shell: p.shell ?? false });
  if (res.status === 0) {
    opened = true;
    break;
  }
}

if (!opened) {
  console.log(`Open your browser at: ${url}`);
}
