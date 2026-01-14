import type { NodeId } from "@metaverse-kit/protocol";

export type FrameLabel = "FrameA" | "FrameB";
export type ContextLabel = "Local" | "Remote" | "Proposed" | "Canonical";
export type BlockLabel = "Block1" | "Block2";
export type RecordLabel = "Record1" | "Record2";
export type ClosureLabel = "Closure1" | "Closure2";
export type LogicLabel = "Logic1" | "Logic2";
export type RelationLabel = "Relation1" | "Relation2";
export type AtomLabel = "L" | "R";

export interface CanonicalPathParts {
  frame: FrameLabel;
  context: ContextLabel;
  block: BlockLabel;
  record: RecordLabel;
  closure: ClosureLabel;
  logic: LogicLabel;
  relation: RelationLabel;
  atom: AtomLabel;
}

export const STATE256_PATH_PREFIX = "State";

const FRAME_INDEX: Record<FrameLabel, number> = {
  FrameA: 0,
  FrameB: 1,
};

const CONTEXT_INDEX: Record<ContextLabel, number> = {
  Local: 0,
  Remote: 1,
  Proposed: 2,
  Canonical: 3,
};

const BLOCK_INDEX: Record<BlockLabel, number> = {
  Block1: 0,
  Block2: 1,
};

const RECORD_INDEX: Record<RecordLabel, number> = {
  Record1: 0,
  Record2: 1,
};

const CLOSURE_INDEX: Record<ClosureLabel, number> = {
  Closure1: 0,
  Closure2: 1,
};

const LOGIC_INDEX: Record<LogicLabel, number> = {
  Logic1: 0,
  Logic2: 1,
};

const RELATION_INDEX: Record<RelationLabel, number> = {
  Relation1: 0,
  Relation2: 1,
};

const ATOM_INDEX: Record<AtomLabel, number> = {
  L: 0,
  R: 1,
};

export function parseCanonicalPath(path: string): CanonicalPathParts {
  const parts = path.split(".");
  if (parts.length !== 9 || parts[0] !== STATE256_PATH_PREFIX) {
    throw new Error(`Invalid State256 path: ${path}`);
  }

  const frame = parts[1] as FrameLabel;
  const context = parts[2] as ContextLabel;
  const block = parts[3] as BlockLabel;
  const record = parts[4] as RecordLabel;
  const closure = parts[5] as ClosureLabel;
  const logic = parts[6] as LogicLabel;
  const relation = parts[7] as RelationLabel;
  const atom = parts[8] as AtomLabel;

  if (!(frame in FRAME_INDEX)) throw new Error(`Invalid Frame in path: ${path}`);
  if (!(context in CONTEXT_INDEX)) throw new Error(`Invalid Context in path: ${path}`);
  if (!(block in BLOCK_INDEX)) throw new Error(`Invalid Block in path: ${path}`);
  if (!(record in RECORD_INDEX)) throw new Error(`Invalid Record in path: ${path}`);
  if (!(closure in CLOSURE_INDEX)) throw new Error(`Invalid Closure in path: ${path}`);
  if (!(logic in LOGIC_INDEX)) throw new Error(`Invalid Logic in path: ${path}`);
  if (!(relation in RELATION_INDEX)) throw new Error(`Invalid Relation in path: ${path}`);
  if (!(atom in ATOM_INDEX)) throw new Error(`Invalid Atom in path: ${path}`);

  return { frame, context, block, record, closure, logic, relation, atom };
}

export function slotFromCanonicalParts(parts: CanonicalPathParts): number {
  const frame = FRAME_INDEX[parts.frame];
  const context = CONTEXT_INDEX[parts.context];
  const block = BLOCK_INDEX[parts.block];
  const record = RECORD_INDEX[parts.record];
  const closure = CLOSURE_INDEX[parts.closure];
  const logic = LOGIC_INDEX[parts.logic];
  const relation = RELATION_INDEX[parts.relation];
  const atom = ATOM_INDEX[parts.atom];

  return (
    (((((((
      frame * 4 + context) * 2 + block) * 2 + record) * 2 + closure) * 2 + logic) * 2 + relation) * 2 + atom
    )
  );
}

export function slotFromCanonicalPath(path: string): number {
  return slotFromCanonicalParts(parseCanonicalPath(path));
}

export function canonicalPathFromSlot(slot: number): string {
  if (!Number.isInteger(slot) || slot < 0 || slot > 255) {
    throw new Error(`Slot out of range: ${slot}`);
  }

  let remaining = slot;
  const atom = remaining & 1;
  remaining >>= 1;
  const relation = remaining & 1;
  remaining >>= 1;
  const logic = remaining & 1;
  remaining >>= 1;
  const closure = remaining & 1;
  remaining >>= 1;
  const record = remaining & 1;
  remaining >>= 1;
  const block = remaining & 1;
  remaining >>= 1;
  const context = remaining & 3;
  remaining >>= 2;
  const frame = remaining & 1;

  const frameLabel = frame === 0 ? "FrameA" : "FrameB";
  const contextLabel = (["Local", "Remote", "Proposed", "Canonical"] as const)[context];
  const blockLabel = block === 0 ? "Block1" : "Block2";
  const recordLabel = record === 0 ? "Record1" : "Record2";
  const closureLabel = closure === 0 ? "Closure1" : "Closure2";
  const logicLabel = logic === 0 ? "Logic1" : "Logic2";
  const relationLabel = relation === 0 ? "Relation1" : "Relation2";
  const atomLabel = atom === 0 ? "L" : "R";

  return [
    STATE256_PATH_PREFIX,
    frameLabel,
    contextLabel,
    blockLabel,
    recordLabel,
    closureLabel,
    logicLabel,
    relationLabel,
    atomLabel,
  ].join(".");
}

export function resolveState256Slot(nodeId: NodeId): number | null {
  if (nodeId.startsWith(`${STATE256_PATH_PREFIX}.`)) {
    return slotFromCanonicalPath(nodeId);
  }

  return null;
}
