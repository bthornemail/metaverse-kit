import type { NodeId } from "@metaverse-kit/protocol";
import { RegisterFile, type Vec3 } from "../registers/register-file.js";
import { MobiusNormalizer, type CanonicalForm } from "../mobius/normalizer.js";
import { HamiltonianRouter } from "../hamiltonian/router.js";
import { resolveState256Slot } from "../slots/canonical.js";

export interface State256NodeLike {
  node_id: NodeId;
  deleted?: boolean;
}

export interface State256ProjectionOptions {
  includeDeleted?: boolean;
  normalize?: boolean;
}

export interface State256Projection {
  root: string;
  positions: Array<{ nodeId: NodeId; position: Vec3; slot: number }>;
  canonicalForm?: CanonicalForm;
  registerFile: RegisterFile;
}

export function buildState256Projection(
  nodes: State256NodeLike[],
  options: State256ProjectionOptions = {}
): State256Projection {
  const registerFile = new RegisterFile();
  const includeDeleted = options.includeDeleted ?? false;

  for (const node of nodes) {
    if (!includeDeleted && node.deleted) continue;
    const slot = resolveState256Slot(node.node_id);
    if (slot === null) continue;
    registerFile.loadAtom(node.node_id, slot);
  }

  let canonicalForm: CanonicalForm | undefined;
  if (options.normalize ?? true) {
    const normalizer = new MobiusNormalizer(registerFile);
    canonicalForm = normalizer.normalize();
  }

  const router = new HamiltonianRouter(registerFile);
  const path = router.computePath();
  const positions = Array.from(router.iteratePath(path)).map((entry) => ({
    nodeId: entry.nodeId,
    position: entry.position,
    slot: entry.slot,
  }));

  return {
    root: registerFile.toHex(),
    positions,
    canonicalForm,
    registerFile,
  };
}

export function computeState256Root(
  nodes: State256NodeLike[],
  options: State256ProjectionOptions = {}
): string {
  const projection = buildState256Projection(nodes, options);
  return projection.root;
}

export const STATE256_PROPERTY_HINTS = null;
