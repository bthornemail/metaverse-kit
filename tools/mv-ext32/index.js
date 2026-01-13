#!/usr/bin/env node
import fs from "fs";
import path from "path";

function usage() {
  console.log("Usage: mv-ext32 --file <pack.json> [--server http://localhost:8080]");
  process.exit(1);
}

const args = process.argv.slice(2);
let file = "";
let server = "http://localhost:8080";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--file") file = args[i + 1];
  if (args[i] === "--server") server = args[i + 1];
}

if (!file) usage();

const filePath = path.resolve(process.cwd(), file);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const raw = fs.readFileSync(filePath, "utf-8");
const pack = JSON.parse(raw);

const res = await fetch(`${server}/ext32/packs`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pack }),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`Failed: ${res.status} ${text}`);
  process.exit(1);
}

console.log("EXT32 pack registered.");
