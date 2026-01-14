import type { AtomValue } from "../../relations/tree.js";

export interface State256ProgramOptions {
  includeHash?: boolean;
  includeHalt?: boolean;
}

export function buildState256Program(
  atoms: AtomValue[],
  options: State256ProgramOptions = {}
): string {
  if (atoms.length !== 256) {
    throw new Error(`State256 requires 256 atoms, got ${atoms.length}`);
  }

  const includeHash = options.includeHash ?? true;
  const includeHalt = options.includeHalt ?? true;

  const lines: string[] = [];

  for (const atom of atoms) {
    if (typeof atom === "number") {
      lines.push(`PUSHI ${atom}`);
    } else {
      lines.push(`PUSH "${escapeString(atom)}"`);
    }
  }

  let count = 256;
  while (count > 1) {
    const pairs = count / 2;
    for (let i = 0; i < pairs; i++) {
      lines.push("PAIR");
    }
    count = pairs;
  }

  if (includeHash) {
    lines.push("HASH");
  }

  if (includeHalt) {
    lines.push("HALT");
  }

  return lines.join("\n") + "\n";
}

export function buildSequentialState256Program(options?: State256ProgramOptions): string {
  const atoms: AtomValue[] = [];
  for (let i = 1; i <= 256; i++) {
    atoms.push(`E${i}`);
  }
  return buildState256Program(atoms, options);
}

function escapeString(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
