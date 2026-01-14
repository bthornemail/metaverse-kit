export {
  Architecture,
  detectArchitecture,
  RegisterFile,
  SymbolicAtom,
} from "./registers/register-file.js";
export { HamiltonianRouter } from "./hamiltonian/router.js";
export { MobiusNormalizer } from "./mobius/normalizer.js";
export {
  STATE256_PATH_PREFIX,
  parseCanonicalPath,
  slotFromCanonicalParts,
  slotFromCanonicalPath,
  canonicalPathFromSlot,
  resolveState256Slot,
} from "./slots/canonical.js";
export {
  buildState256Projection,
  computeState256Root,
  STATE256_PROPERTY_HINTS,
} from "./projector/state256-projector.js";
export { loadWasmSimdBackend } from "./wasm/simd-backend.js";
export type { WasmSimdBackend } from "./wasm/simd-backend.js";
export { loadWasmHashBackend } from "./wasm/hash-kernel.js";
export { assemble } from "./vm/assembler.js";
export { AtomVM, runProgram } from "./vm/vm.js";
export { Opcode, OPCODE_NAMES } from "./vm/opcodes.js";
export {
  buildState256Program,
  buildSequentialState256Program,
} from "./vm/programs/state256-builder.js";
export {
  STATE256_EMPTY,
  STATE256_META_SLOT,
  createEmptyState,
  cloneState,
  setState256Meta,
  getState256Meta,
} from "./projection/types.js";
export type { Projection, State256Meta, State256State } from "./projection/types.js";
export { routeProjection } from "./projection/router.js";
export {
  pair,
  buildRelationTree,
  buildState256,
  zeroState256,
  hashRelation,
  toString as relationToString,
} from "./relations/tree.js";
export type {
  State256NodeLike,
  State256Projection,
  State256ProjectionOptions,
} from "./projector/state256-projector.js";
export type {
  CanonicalPathParts,
  FrameLabel,
  ContextLabel,
  BlockLabel,
  RecordLabel,
  ClosureLabel,
  LogicLabel,
  RelationLabel,
  AtomLabel,
} from "./slots/canonical.js";
