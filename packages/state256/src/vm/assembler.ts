import { Opcode } from "./opcodes.js";

export interface AssembleResult {
  bytecode: Uint8Array;
}

const TEXT_ENCODER = new TextEncoder();

export function assemble(source: string): AssembleResult {
  const lines = source.split(/\r?\n/);
  const labels = new Map<string, number>();
  let offset = 0;

  for (const rawLine of lines) {
    const line = stripComment(rawLine);
    if (!line) continue;
    if (line.endsWith(":")) {
      labels.set(line.slice(0, -1), offset);
      continue;
    }

    const [opToken, ...rest] = tokenize(line);
    const opcode = opcodeFromToken(opToken);
    offset += instructionSize(opcode, rest);
  }

  const bytes: number[] = [];
  for (const rawLine of lines) {
    const line = stripComment(rawLine);
    if (!line) continue;
    if (line.endsWith(":")) continue;

    const [opToken, ...rest] = tokenize(line);
    const opcode = opcodeFromToken(opToken);
    bytes.push(opcode);

    switch (opcode) {
      case Opcode.PUSH: {
        const value = parseStringOperand(rest);
        const data = TEXT_ENCODER.encode(value);
        if (data.length > 0xffff) {
          throw new Error("PUSH literal too long");
        }
        bytes.push(data.length & 0xff, (data.length >> 8) & 0xff);
        for (const b of data) bytes.push(b);
        break;
      }

      case Opcode.PUSHI: {
        const value = parseIntOperand(opToken, rest);
        writeI32(bytes, value);
        break;
      }

      case Opcode.LOAD:
      case Opcode.STORE: {
        if (rest.length !== 1) {
          throw new Error(`${opToken} expects 1 operand`);
        }
        const index = Number(rest[0]);
        if (!Number.isInteger(index) || index < 0 || index > 255) {
          throw new Error(`${opToken} register index out of range: ${rest[0]}`);
        }
        bytes.push(index & 0xff);
        break;
      }

      case Opcode.JUMP:
      case Opcode.JZ:
      case Opcode.JNZ: {
        if (rest.length !== 1) {
          throw new Error(`${opToken} expects 1 operand`);
        }
        const target = resolveLabelOrNumber(rest[0], labels);
        if (target < 0 || target > 0xffff) {
          throw new Error(`${opToken} target out of range: ${target}`);
        }
        bytes.push(target & 0xff, (target >> 8) & 0xff);
        break;
      }

      case Opcode.CALL: {
        if (rest.length !== 1) {
          throw new Error(`${opToken} expects 1 operand`);
        }
        const target = resolveLabelOrNumber(rest[0], labels);
        if (target < 0 || target > 0xffff) {
          throw new Error(`${opToken} target out of range: ${target}`);
        }
        bytes.push(target & 0xff, (target >> 8) & 0xff);
        break;
      }

      default:
        if (rest.length > 0) {
          throw new Error(`${opToken} expects no operands`);
        }
        break;
    }
  }

  return { bytecode: Uint8Array.from(bytes) };
}

function opcodeFromToken(token: string): Opcode {
  switch (token.toUpperCase()) {
    case "HALT":
      return Opcode.HALT;
    case "PUSH":
      return Opcode.PUSH;
    case "PUSHI":
      return Opcode.PUSHI;
    case "PAIR":
      return Opcode.PAIR;
    case "UNPAIR":
      return Opcode.UNPAIR;
    case "HASH":
      return Opcode.HASH;
    case "DUP":
      return Opcode.DUP;
    case "SWAP":
      return Opcode.SWAP;
    case "DROP":
      return Opcode.DROP;
    case "LOAD":
      return Opcode.LOAD;
    case "STORE":
      return Opcode.STORE;
    case "ADD":
      return Opcode.ADD;
    case "EQ":
      return Opcode.EQ;
    case "JUMP":
      return Opcode.JUMP;
    case "JZ":
      return Opcode.JZ;
    case "JNZ":
      return Opcode.JNZ;
    case "OVER":
      return Opcode.OVER;
    case "ROT":
      return Opcode.ROT;
    case "CALL":
      return Opcode.CALL;
    case "RET":
      return Opcode.RET;
    default:
      throw new Error(`Unknown opcode: ${token}`);
  }
}

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\"") {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }

    if (!inQuotes && /\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function parseStringOperand(operands: string[]): string {
  if (operands.length !== 1) {
    throw new Error("PUSH expects a single literal operand");
  }

  const raw = operands[0];
  if (raw.startsWith("\"") && raw.endsWith("\"") && raw.length >= 2) {
    return raw.slice(1, -1);
  }

  return raw;
}

function parseIntOperand(opToken: string, operands: string[]): number {
  if (operands.length !== 1) {
    throw new Error(`${opToken} expects a single integer operand`);
  }

  const value = Number(operands[0]);
  if (!Number.isInteger(value)) {
    throw new Error(`${opToken} expects an integer operand`);
  }

  return value;
}

function resolveLabelOrNumber(token: string, labels: Map<string, number>): number {
  if (labels.has(token)) {
    return labels.get(token) as number;
  }

  const value = Number(token);
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid jump target: ${token}`);
  }

  return value;
}

function instructionSize(opcode: Opcode, operands: string[]): number {
  switch (opcode) {
    case Opcode.PUSH: {
      const value = parseStringOperand(operands);
      const data = TEXT_ENCODER.encode(value);
      return 1 + 2 + data.length;
    }
    case Opcode.PUSHI:
      return 1 + 4;
    case Opcode.LOAD:
    case Opcode.STORE:
      return 1 + 1;
    case Opcode.JUMP:
    case Opcode.JZ:
    case Opcode.JNZ:
    case Opcode.CALL:
      return 1 + 2;
    default:
      return 1;
  }
}

function stripComment(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("#") || trimmed.startsWith(";")) return "";
  const hashIdx = trimmed.indexOf("#");
  const semiIdx = trimmed.indexOf(";");
  let cut = trimmed.length;
  if (hashIdx >= 0) cut = Math.min(cut, hashIdx);
  if (semiIdx >= 0) cut = Math.min(cut, semiIdx);
  return trimmed.slice(0, cut).trim();
}

function writeI32(bytes: number[], value: number): void {
  const v = value | 0;
  bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
}
