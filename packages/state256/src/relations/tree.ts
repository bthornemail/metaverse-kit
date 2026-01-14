export type AtomValue = string | number;

export interface RelationNode {
  left: RelationNode | AtomValue;
  right: RelationNode | AtomValue;
  hash: string;
}

export interface RelationTreeBuild {
  root: RelationNode | AtomValue;
  depth: number;
}

export function pair(left: RelationNode | AtomValue, right: RelationNode | AtomValue): RelationNode {
  const repr = `(${toString(left)} . ${toString(right)})`;
  return {
    left,
    right,
    hash: hashString(repr),
  };
}

export function buildRelationTree(atoms: AtomValue[]): RelationTreeBuild {
  if (atoms.length === 0) {
    throw new Error("atoms list must not be empty");
  }

  if (!isPowerOfTwo(atoms.length)) {
    throw new Error(`atoms length must be power of two, got ${atoms.length}`);
  }

  let level: Array<RelationNode | AtomValue> = [...atoms];
  let depth = 0;

  while (level.length > 1) {
    const next: Array<RelationNode | AtomValue> = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(pair(level[i], level[i + 1]));
    }
    level = next;
    depth++;
  }

  return { root: level[0], depth };
}

export function buildState256(atoms: AtomValue[]): RelationTreeBuild {
  if (atoms.length !== 256) {
    throw new Error(`State256 requires 256 atoms, got ${atoms.length}`);
  }
  return buildRelationTree(atoms);
}

export function zeroState256(): AtomValue[] {
  return Array.from({ length: 256 }, () => "Ø");
}

export function toString(node: RelationNode | AtomValue): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return `(${toString(node.left)} . ${toString(node.right)})`;
}

export function hashRelation(node: RelationNode | AtomValue): string {
  if (typeof node === "string" || typeof node === "number") {
    return hashString(String(node));
  }
  return node.hash;
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
