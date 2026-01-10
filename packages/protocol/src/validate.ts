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

      case "set_geometry":
      case "set_media":
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
