// Validation functions for the Metaverse Kit event protocol
// Implements fail-fast validation with detailed error messages

import {
  Invariant,
  Scope,
  Transform,
  WorldEvent,
  EventEnvelope,
  Operation,
} from "./types.js";

// ============================================================================
// Validation Error Class
// ============================================================================

export class ValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join("\n"));
    this.name = "ValidationError";
  }
}

// ============================================================================
// Required Root Invariants
// ============================================================================

export const ROOT_INVARIANTS: Invariant[] = [
  "adjacency",
  "exclusion",
  "consistency",
  "boundary_discipline",
  "authority_nontransfer",
];

// ============================================================================
// Type Guard Helpers
// ============================================================================

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

// ============================================================================
// Scope Validation
// ============================================================================

export function validateScope(scope: unknown): Scope {
  const problems: string[] = [];

  if (!isObject(scope)) {
    throw new ValidationError(["scope must be an object"]);
  }

  const realm = scope["realm"];
  const authority = scope["authority"];
  const boundary = scope["boundary"];
  const policy = scope["policy"];

  const realms = new Set<string>(["personal", "team", "public"]);
  const authorities = new Set<string>(["source", "derived"]);
  const boundaries = new Set<string>(["interior", "boundary", "exterior"]);
  const policies = new Set<string>(["public", "private", "redacted"]);

  if (!isString(realm) || !realms.has(realm)) {
    problems.push("scope.realm must be 'personal', 'team', or 'public'");
  }
  if (!isString(authority) || !authorities.has(authority)) {
    problems.push("scope.authority must be 'source' or 'derived'");
  }
  if (!isString(boundary) || !boundaries.has(boundary)) {
    problems.push("scope.boundary must be 'interior', 'boundary', or 'exterior'");
  }
  if (policy !== undefined && (!isString(policy) || !policies.has(policy))) {
    problems.push("scope.policy must be 'public', 'private', or 'redacted' if provided");
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }

  return scope as unknown as Scope;
}

// ============================================================================
// Transform Validation
// ============================================================================

export function validateTransform(t: unknown): Transform {
  const problems: string[] = [];

  if (!isObject(t)) {
    throw new ValidationError(["transform must be an object"]);
  }

  const pos = t["position"];
  const rot = t["rotation_quat"];
  const scl = t["scale"];

  const isTuple3 = (x: unknown): x is [number, number, number] =>
    isArray(x) && x.length === 3 && x.every(isNumber);

  const isTuple4 = (x: unknown): x is [number, number, number, number] =>
    isArray(x) && x.length === 4 && x.every(isNumber);

  if (!isTuple3(pos)) {
    problems.push("transform.position must be [x, y, z] with numeric values");
  }
  if (!isTuple4(rot)) {
    problems.push("transform.rotation_quat must be [x, y, z, w] with numeric values");
  }
  if (!isTuple3(scl)) {
    problems.push("transform.scale must be [sx, sy, sz] with numeric values");
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }

  return t as unknown as Transform;
}

// ============================================================================
// Event Envelope Validation
// ============================================================================

export function validateEnvelope(e: unknown): EventEnvelope {
  const problems: string[] = [];

  if (!isObject(e)) {
    throw new ValidationError(["event must be an object"]);
  }

  // Required string fields
  const requiredStr: Array<keyof EventEnvelope> = [
    "event_id",
    "space_id",
    "layer_id",
    "actor_id",
    "operation",
    "tile",
  ];

  for (const k of requiredStr) {
    if (!isString(e[k])) {
      problems.push(`${String(k)} must be a string`);
    }
  }

  // timestamp must be number
  if (!isNumber(e["timestamp"])) {
    problems.push("timestamp must be a finite number");
  }

  // previous_events must be string array
  if (!isArray(e["previous_events"])) {
    problems.push("previous_events must be an array");
  } else if (!e["previous_events"].every(isString)) {
    problems.push("previous_events must be an array of strings (event IDs)");
  }

  // Validate scope
  try {
    validateScope(e["scope"]);
  } catch (err) {
    if (err instanceof ValidationError) {
      problems.push(...err.problems);
    } else {
      problems.push(`scope validation failed: ${String(err)}`);
    }
  }

  // Validate invariants
  if (!isArray(e["preserves_invariants"])) {
    problems.push("preserves_invariants must be an array");
  } else {
    const invSet = new Set(e["preserves_invariants"]);
    const missing = ROOT_INVARIANTS.filter(inv => !invSet.has(inv));
    if (missing.length > 0) {
      problems.push(`preserves_invariants must include all root invariants: ${ROOT_INVARIANTS.join(", ")}`);
      problems.push(`  Missing: ${missing.join(", ")}`);
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }

  return e as unknown as EventEnvelope;
}

// ============================================================================
// Operation-specific Validation
// ============================================================================

function validateCreateNode(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["node_id"])) {
    problems.push("create_node.node_id must be a string");
  }
  if (!isString(obj["kind"])) {
    problems.push("create_node.kind must be a string");
  }

  try {
    validateTransform(obj["transform"]);
  } catch (e) {
    if (e instanceof ValidationError) {
      problems.push(...e.problems);
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateUpdateTransform(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["node_id"])) {
    problems.push("update_transform.node_id must be a string");
  }

  try {
    validateTransform(obj["transform"]);
  } catch (e) {
    if (e instanceof ValidationError) {
      problems.push(...e.problems);
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateSetProperties(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["node_id"])) {
    problems.push("set_properties.node_id must be a string");
  }
  if (!isObject(obj["properties"])) {
    problems.push("set_properties.properties must be an object");
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateLinkNodes(obj: Record<string, unknown>, op: string): void {
  const problems: string[] = [];

  if (!isString(obj["from_node"])) {
    problems.push(`${op}.from_node must be a string`);
  }
  if (!isString(obj["relation"])) {
    problems.push(`${op}.relation must be a string`);
  }
  if (!isString(obj["to_node"])) {
    problems.push(`${op}.to_node must be a string`);
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateDeleteNode(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["node_id"])) {
    problems.push("delete_node.node_id must be a string");
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateMerge(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isArray(obj["previous_events"]) || obj["previous_events"].length < 2) {
    problems.push("merge.previous_events must have at least 2 parent events");
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateSetGeometry(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["node_id"])) {
    problems.push("set_geometry.node_id must be a string");
  }
  if (!isObject(obj["geometry"])) {
    problems.push("set_geometry.geometry must be an object");
  } else {
    const geometry = obj["geometry"] as Record<string, unknown>;
    const kind = geometry["kind"];
    if (!isString(kind) || !["svg", "obj", "glb"].includes(kind)) {
      problems.push("set_geometry.geometry.kind must be 'svg', 'obj', or 'glb'");
    }
    if (!isString(geometry["ref"])) {
      problems.push("set_geometry.geometry.ref must be a string");
    }
    if (
      geometry["units"] !== undefined &&
      (!isString(geometry["units"]) || !["m", "cm", "px"].includes(geometry["units"]))
    ) {
      problems.push("set_geometry.geometry.units must be 'm', 'cm', or 'px' if provided");
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateSetMedia(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["node_id"])) {
    problems.push("set_media.node_id must be a string");
  }
  if (!isObject(obj["media"])) {
    problems.push("set_media.media must be an object");
  } else {
    const media = obj["media"] as Record<string, unknown>;
    const kind = media["kind"];
    if (
      !isString(kind) ||
      !["svg", "obj", "mtl", "glb", "wav", "mp4"].includes(kind)
    ) {
      problems.push("set_media.media.kind must be svg|obj|mtl|glb|wav|mp4");
    }
    if (!isString(media["ref"])) {
      problems.push("set_media.media.ref must be a string");
    }
    if (media["mime"] !== undefined && !isString(media["mime"])) {
      problems.push("set_media.media.mime must be a string if provided");
    }
    if (media["meta"] !== undefined && !isObject(media["meta"])) {
      problems.push("set_media.media.meta must be an object if provided");
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateSetText(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["node_id"])) {
    problems.push("set_text.node_id must be a string");
  }
  if (!isObject(obj["text"])) {
    problems.push("set_text.text must be an object");
  } else {
    const text = obj["text"] as Record<string, unknown>;
    const kind = text["kind"];
    if (
      !isString(kind) ||
      !["plain", "markdown", "code", "json", "yaml"].includes(kind)
    ) {
      problems.push("set_text.text.kind must be plain|markdown|code|json|yaml");
    }
    if (!isString(text["ref"])) {
      problems.push("set_text.text.ref must be a string");
    }
    if (text["language"] !== undefined && !isString(text["language"])) {
      problems.push("set_text.text.language must be a string if provided");
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateSetDocument(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["node_id"])) {
    problems.push("set_document.node_id must be a string");
  }
  if (!isObject(obj["document"])) {
    problems.push("set_document.document must be an object");
  } else {
    const doc = obj["document"] as Record<string, unknown>;
    const kind = doc["kind"];
    if (
      !isString(kind) ||
      !["pdf", "md-page", "canvas2d", "html"].includes(kind)
    ) {
      problems.push("set_document.document.kind must be pdf|md-page|canvas2d|html");
    }
    if (!isString(doc["ref"])) {
      problems.push("set_document.document.ref must be a string");
    }
    if (doc["pages"] !== undefined && !isNumber(doc["pages"])) {
      problems.push("set_document.document.pages must be a number if provided");
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validatePhysicsStep(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["solver"])) {
    problems.push("physics_step.solver must be a string");
  }
  if (!isNumber(obj["tick"])) {
    problems.push("physics_step.tick must be a number");
  }
  if (!isNumber(obj["delta_time"])) {
    problems.push("physics_step.delta_time must be a number");
  }
  if (!isArray(obj["updates"])) {
    problems.push("physics_step.updates must be an array");
  } else {
    // Validate each update has node_id and transform
    for (let i = 0; i < obj["updates"].length; i++) {
      const upd = obj["updates"][i];
      if (!isObject(upd)) {
        problems.push(`physics_step.updates[${i}] must be an object`);
        continue;
      }
      if (!isString(upd["node_id"])) {
        problems.push(`physics_step.updates[${i}].node_id must be a string`);
      }
      try {
        validateTransform(upd["transform"]);
      } catch (e) {
        if (e instanceof ValidationError) {
          problems.push(`physics_step.updates[${i}]: ${e.message}`);
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateDerivedFeature32(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["basis"])) {
    problems.push("derived_feature32.basis must be a string");
  }

  if (!isObject(obj["for"])) {
    problems.push("derived_feature32.for must be an object");
  } else if (!isString((obj["for"] as Record<string, unknown>)["tile"])) {
    problems.push("derived_feature32.for.tile must be a string");
  }

  if (!isArray(obj["features"]) || obj["features"].length !== 32) {
    problems.push("derived_feature32.features must be an array of 32 numbers");
  } else if (!obj["features"].every((x: unknown) => isNumber(x) && x >= 0 && x <= 15)) {
    problems.push("derived_feature32.features must contain numbers in range 0..15");
  }

  if (obj["packed64"] !== undefined && !isString(obj["packed64"])) {
    problems.push("derived_feature32.packed64 must be a string if provided");
  }

  if (obj["packed128"] !== undefined) {
    const p128 = obj["packed128"];
    if (!isArray(p128) || p128.length !== 2 || !p128.every(isString)) {
      problems.push("derived_feature32.packed128 must be a [string, string] if provided");
    }
  }

  if (isObject(obj["scope"])) {
    const authority = (obj["scope"] as Record<string, unknown>)["authority"];
    if (authority !== "derived") {
      problems.push("derived_feature32.scope.authority must be 'derived'");
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateProposal(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["proposal_id"])) {
    problems.push("proposal.proposal_id must be a string");
  }
  if (!isString(obj["layer"])) {
    problems.push("proposal.layer must be a string");
  }
  if (!isObject(obj["target"])) {
    problems.push("proposal.target must be an object");
  }
  if (!isObject(obj["payload"])) {
    problems.push("proposal.payload must be an object");
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

function validateAcceptProposal(obj: Record<string, unknown>): void {
  const problems: string[] = [];

  if (!isString(obj["proposal_id"])) {
    problems.push("accept_proposal.proposal_id must be a string");
  }
  if (!isString(obj["accepted_by"])) {
    problems.push("accept_proposal.accepted_by must be a string");
  }
  if (!isString(obj["scope"]) || !["local", "federated"].includes(obj["scope"] as string)) {
    problems.push("accept_proposal.scope must be 'local' or 'federated'");
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

// ============================================================================
// Full World Event Validation
// ============================================================================

export function validateWorldEvent(ev: unknown): WorldEvent {
  // First validate the envelope
  const envelope = validateEnvelope(ev);
  const op = envelope.operation as Operation;
  const obj = ev as Record<string, unknown>;

  // Then validate operation-specific fields
  try {
    switch (op) {
      case "create_node":
        validateCreateNode(obj);
        break;

      case "update_transform":
        validateUpdateTransform(obj);
        break;

      case "set_properties":
        validateSetProperties(obj);
        break;

      case "link_nodes":
      case "unlink_nodes":
        validateLinkNodes(obj, op);
        break;

      case "delete_node":
        validateDeleteNode(obj);
        break;

      case "merge":
        validateMerge(obj);
        break;

      case "physics_step":
        validatePhysicsStep(obj);
        break;

      case "derived_feature32":
        validateDerivedFeature32(obj);
        break;

      case "proposal":
        validateProposal(obj);
        break;

      case "accept_proposal":
        validateAcceptProposal(obj);
        break;

      case "set_geometry":
        validateSetGeometry(obj);
        break;

      case "set_media":
        validateSetMedia(obj);
        break;

      case "set_text":
        validateSetText(obj);
        break;

      case "set_document":
        validateSetDocument(obj);
        break;

      case "set_physics":
        // v1/v2 operations: only envelope required for now
        break;

      default:
        // Macros or forward-compatible operations: only envelope required
        if (op.startsWith("macro.")) {
          // Valid macro operation
          break;
        }
        // Unknown operation - log warning but allow (forward compatibility)
        console.warn(`Unknown operation: ${op} - proceeding with envelope validation only`);
        break;
    }
  } catch (err) {
    // Re-throw validation errors with operation context
    if (err instanceof ValidationError) {
      throw new ValidationError([
        `Validation failed for operation '${op}':`,
        ...err.problems
      ]);
    }
    throw err;
  }

  return ev as WorldEvent;
}

// ============================================================================
// Batch Validation
// ============================================================================

export function validateWorldEvents(events: unknown[]): WorldEvent[] {
  const validated: WorldEvent[] = [];
  const errors: Array<{ index: number; error: ValidationError }> = [];

  for (let i = 0; i < events.length; i++) {
    try {
      validated.push(validateWorldEvent(events[i]));
    } catch (err) {
      if (err instanceof ValidationError) {
        errors.push({ index: i, error: err });
      } else {
        throw err; // Re-throw unexpected errors
      }
    }
  }

  if (errors.length > 0) {
    const problems = errors.flatMap(({ index, error }) =>
      error.problems.map(p => `Event ${index}: ${p}`)
    );
    throw new ValidationError(problems);
  }

  return validated;
}
