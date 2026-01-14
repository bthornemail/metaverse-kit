#!/usr/bin/env node
import fs from "fs/promises";
import {
  AtomVM,
  assemble,
  relationToString,
  buildState256,
  zeroState256,
  hashRelation,
} from "./index.js";

const USAGE = `
Usage: state256-vm [file] [--registers] [--state256] [--zero] [--state256-seq]

If no file is provided, reads from stdin.
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(USAGE.trimStart());
    return;
  }

  const showRegisters = args.includes("--registers");
  const state256Mode = args.includes("--state256");
  const state256SeqMode = args.includes("--state256-seq");
  const zeroMode = args.includes("--zero");
  const fileArg = args.find((arg) => !arg.startsWith("--"));

  const source = fileArg ? await fs.readFile(fileArg, "utf8") : await readStdin();
  if (state256Mode || state256SeqMode) {
    const atoms = state256SeqMode ? buildSequentialAtoms() : (zeroMode ? zeroState256() : parseAtoms(source));
    const { root, depth } = buildState256(atoms);
    const rootHash = hashRelation(root);
    process.stdout.write(`state256 depth=${depth} root=${rootHash}\n`);
    return;
  }

  const { bytecode } = assemble(source);
  const vm = new AtomVM();
  const state = vm.run(bytecode);

  const stackOut = state.stack.map(formatValue);
  process.stdout.write(`stack (${stackOut.length}): ${JSON.stringify(stackOut)}\n`);

  if (showRegisters) {
    const regOut: Record<string, string> = {};
    state.registers.forEach((value, index) => {
      if (value !== null) {
        regOut[String(index)] = formatValue(value);
      }
    });
    process.stdout.write(`registers: ${JSON.stringify(regOut)}\n`);
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  return relationToString(value as any);
}

function parseAtoms(source: string): string[] {
  const atoms = source.split(/\s+/).filter(Boolean);
  if (atoms.length !== 256) {
    throw new Error(`State256 requires 256 atoms, got ${atoms.length}`);
  }
  return atoms;
}

function buildSequentialAtoms(): string[] {
  const atoms: string[] = [];
  for (let i = 1; i <= 256; i++) {
    atoms.push(`E${i}`);
  }
  return atoms;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
