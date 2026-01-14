import { Opcode } from "./opcodes.js";
import { assemble } from "./assembler.js";
import { pair, hashRelation, type RelationNode } from "../relations/tree.js";

export type VMValue = RelationNode | string | number;

export interface VMState {
  stack: VMValue[];
  registers: Array<VMValue | null>;
  callStack: number[];
  ip: number;
  halted: boolean;
}

export class AtomVM {
  readonly stack: VMValue[] = [];
  readonly registers: Array<VMValue | null>;
  readonly callStack: number[] = [];
  ip = 0;
  halted = false;

  constructor(registerCount: number = 256) {
    this.registers = Array.from({ length: registerCount }, () => null);
  }

  reset(): void {
    this.stack.length = 0;
    this.registers.fill(null);
    this.callStack.length = 0;
    this.ip = 0;
    this.halted = false;
  }

  run(bytecode: Uint8Array): VMState {
    this.ip = 0;
    this.halted = false;

    while (!this.halted && this.ip < bytecode.length) {
      const opcode = bytecode[this.ip++] as Opcode;
      this.step(opcode, bytecode);
    }

    return this.snapshot();
  }

  step(opcode: Opcode, bytecode: Uint8Array): void {
    switch (opcode) {
      case Opcode.HALT:
        this.halted = true;
        return;

      case Opcode.PUSH: {
        const length = readU16(bytecode, this.ip);
        this.ip += 2;
        const slice = bytecode.slice(this.ip, this.ip + length);
        this.ip += length;
        const value = new TextDecoder().decode(slice);
        this.stack.push(value);
        return;
      }

      case Opcode.PUSHI: {
        const value = readI32(bytecode, this.ip);
        this.ip += 4;
        this.stack.push(value);
        return;
      }

      case Opcode.PAIR: {
        const right = this.pop();
        const left = this.pop();
        this.stack.push(pair(left, right));
        return;
      }

      case Opcode.UNPAIR: {
        const node = this.pop();
        if (typeof node === "string") {
          throw new Error("UNPAIR expects relation node, got atom");
        }
        // Push left then right so right is on top (canonical order).
        this.stack.push(node.left);
        this.stack.push(node.right);
        return;
      }

      case Opcode.HASH: {
        const value = this.pop();
        this.stack.push(hashRelation(value));
        return;
      }

      case Opcode.DUP: {
        const value = this.peek();
        this.stack.push(value);
        return;
      }

      case Opcode.SWAP: {
        if (this.stack.length < 2) {
          throw new Error("SWAP requires at least two values");
        }
        const top = this.stack.pop() as VMValue;
        const next = this.stack.pop() as VMValue;
        this.stack.push(top, next);
        return;
      }

      case Opcode.DROP: {
        this.pop();
        return;
      }

      case Opcode.ADD: {
        const right = this.popNumber("ADD");
        const left = this.popNumber("ADD");
        this.stack.push(left + right);
        return;
      }

      case Opcode.EQ: {
        const right = this.pop();
        const left = this.pop();
        this.stack.push(left === right ? 1 : 0);
        return;
      }

      case Opcode.JUMP: {
        const target = readU16(bytecode, this.ip);
        this.ip = target;
        return;
      }

      case Opcode.JZ: {
        const target = readU16(bytecode, this.ip);
        this.ip += 2;
        const value = this.popNumber("JZ");
        if (value === 0) this.ip = target;
        return;
      }

      case Opcode.JNZ: {
        const target = readU16(bytecode, this.ip);
        this.ip += 2;
        const value = this.popNumber("JNZ");
        if (value !== 0) this.ip = target;
        return;
      }

      case Opcode.OVER: {
        if (this.stack.length < 2) {
          throw new Error("OVER requires at least two values");
        }
        this.stack.push(this.stack[this.stack.length - 2]);
        return;
      }

      case Opcode.ROT: {
        if (this.stack.length < 3) {
          throw new Error("ROT requires at least three values");
        }
        const c = this.stack.pop() as VMValue;
        const b = this.stack.pop() as VMValue;
        const a = this.stack.pop() as VMValue;
        this.stack.push(b, c, a);
        return;
      }

      case Opcode.CALL: {
        const target = readU16(bytecode, this.ip);
        this.ip += 2;
        this.callStack.push(this.ip);
        this.ip = target;
        return;
      }

      case Opcode.RET: {
        const target = this.callStack.pop();
        if (target === undefined) {
          throw new Error("RET with empty call stack");
        }
        this.ip = target;
        return;
      }

      case Opcode.LOAD: {
        const index = bytecode[this.ip++];
        const value = this.registers[index];
        if (value === null) {
          throw new Error(`LOAD from empty register ${index}`);
        }
        this.stack.push(value);
        return;
      }

      case Opcode.STORE: {
        const index = bytecode[this.ip++];
        this.registers[index] = this.pop();
        return;
      }

      default:
        throw new Error(`Unknown opcode: 0x${opcode.toString(16)}`);
    }
  }

  snapshot(): VMState {
    return {
      stack: [...this.stack],
      registers: [...this.registers],
      callStack: [...this.callStack],
      ip: this.ip,
      halted: this.halted,
    };
  }

  private pop(): VMValue {
    const value = this.stack.pop();
    if (!value) {
      throw new Error("Stack underflow");
    }
    return value;
  }

  private peek(): VMValue {
    const value = this.stack[this.stack.length - 1];
    if (!value) {
      throw new Error("Stack underflow");
    }
    return value;
  }

  private popNumber(op: string): number {
    const value = this.pop();
    if (typeof value !== "number") {
      throw new Error(`${op} expects number, got ${typeof value}`);
    }
    return value;
  }
}

export function runProgram(source: string, vm: AtomVM = new AtomVM()): VMState {
  const { bytecode } = assemble(source);
  return vm.run(bytecode);
}

function readU16(bytes: Uint8Array, offset: number): number {
  if (offset + 1 >= bytes.length) {
    throw new Error("Unexpected EOF while reading u16");
  }
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readI32(bytes: Uint8Array, offset: number): number {
  if (offset + 3 >= bytes.length) {
    throw new Error("Unexpected EOF while reading i32");
  }
  return (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) | 0;
}
