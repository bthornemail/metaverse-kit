// Symbolic/Numeric Boundary Validation
// Enforces the core principle: numeric values must not appear in source authority events

import {
  WorldEvent,
  CreateNodeEvent,
  UpdateTransformEvent,
  PhysicsStepEvent,
  DerivedFeature32Event,
  SetMediaEvent,
  Transform,
  isCreateNodeEvent,
  isUpdateTransformEvent,
  isPhysicsStepEvent,
} from "./types.js";

import { ValidationError } from "./validate.js";

// ============================================================================
// Authority Boundary Rules
// ============================================================================

/**
 * Core principle: Numeric measurements must never appear in source authority events.
 *
 * Allowed in source authority:
 * - Symbolic atoms (IDs, mnemonics, hashes)
 * - Counts and bucket indices (combinatorial properties)
 * - Relations and constraints (graph structure)
 *
 * Prohibited in source authority:
 * - Coordinates (x, y, z positions)
 * - Rotations (quaternions, euler angles)
 * - Scales (numeric scaling factors)
 * - Time measurements (numeric timestamps, durations)
 *
 * These numeric values may only appear in:
 * - Derived authority events (projections, computations)
 * - Ephemeral presence updates (not stored)
 */

// ============================================================================
// Numeric Transform Detection
// ============================================================================

/**
 * Checks if a transform contains numeric measurements (not symbolic)
 */
function hasNumericTransform(transform: Transform): boolean {
  // Any non-zero, non-identity transform is numeric
  const pos = transform.position;
  const rot = transform.rotation_quat;
  const scl = transform.scale;

  // Check for non-zero position
  const hasPosition = pos.some(v => v !== 0);

  // Check for non-identity rotation (identity = [0,0,0,1])
  const hasRotation = !(
    rot[0] === 0 &&
    rot[1] === 0 &&
    rot[2] === 0 &&
    rot[3] === 1
  );

  // Check for non-uniform or non-unit scale
  const hasScale = !(
    scl[0] === 1 &&
    scl[1] === 1 &&
    scl[2] === 1
  );

  return hasPosition || hasRotation || hasScale;
}

// ============================================================================
// Operation-Specific Boundary Validation
// ============================================================================

/**
 * Validates that create_node events with source authority use symbolic transforms only
 */
function validateCreateNodeBoundary(event: CreateNodeEvent): void {
  const problems: string[] = [];

  if (event.scope.authority === "source") {
    if (hasNumericTransform(event.transform)) {
      problems.push(
        "create_node with authority:source cannot contain numeric transforms. " +
        "Use symbolic relations (neighbors, constraints) instead of coordinates. " +
        "Numeric transforms must be in derived authority events only."
      );
      problems.push(
        `  Found: position=${JSON.stringify(event.transform.position)}, ` +
        `rotation=${JSON.stringify(event.transform.rotation_quat)}, ` +
        `scale=${JSON.stringify(event.transform.scale)}`
      );
      problems.push(
        "  Expected: position=[0,0,0], rotation=[0,0,0,1], scale=[1,1,1] " +
        "(identity transform) for source authority"
      );
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

/**
 * Validates that update_transform events with source authority use symbolic transforms only
 */
function validateUpdateTransformBoundary(event: UpdateTransformEvent): void {
  const problems: string[] = [];

  if (event.scope.authority === "source") {
    problems.push(
      "update_transform with authority:source is prohibited. " +
      "Transforms are numeric projections and must not be authoritative. " +
      "Use link_nodes/unlink_nodes to express symbolic spatial relations instead."
    );
    problems.push(
      "  Alternative: Use 'link_nodes' with relation='adjacent' or 'parent' " +
      "to express spatial relationships symbolically."
    );
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

/**
 * Validates that physics_step events always have derived authority
 */
function validatePhysicsStepBoundary(event: PhysicsStepEvent): void {
  const problems: string[] = [];

  if (event.scope.authority !== "derived") {
    problems.push(
      `physics_step must have authority:derived, found authority:${event.scope.authority}. ` +
      "Physics computations are projections of symbolic world state, never authoritative."
    );
  }

  // Physics step events can contain numeric transforms (they're projections)
  // No additional validation needed

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

/**
 * Validates that derived_feature32 events always have derived authority
 */
function validateDerivedFeature32Boundary(event: DerivedFeature32Event): void {
  const problems: string[] = [];

  if (event.scope.authority !== "derived") {
    problems.push(
      `derived_feature32 must have authority:derived, found authority:${event.scope.authority}. ` +
      "Feature extraction is a projection, never authoritative."
    );
  }

  // Features are bucket indices (0..15), which are symbolic
  // This is acceptable even though stored as numbers

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

/**
 * Validates media metadata boundary
 * Media intrinsic properties (width/height from file) are acceptable in source
 * Projected measurements are not
 */
function validateSetMediaBoundary(event: SetMediaEvent): void {
  const problems: string[] = [];

  // Media metadata (width/height/duration) is acceptable if it's intrinsic
  // This is a gray area - documenting the interpretation

  if (event.media.meta && event.scope.authority === "source") {
    // Check if there's a ref (file) - if so, metadata is intrinsic
    if (!event.media.ref) {
      problems.push(
        "set_media with authority:source and metadata requires a ref (file reference). " +
        "Media metadata must be intrinsic properties from the file, not projected measurements."
      );
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(problems);
  }
}

// ============================================================================
// Timestamp Boundary Validation
// ============================================================================

/**
 * Validates that events use ULID-based ordering, not numeric timestamp comparison
 *
 * Note: This is informational - we can't prevent numeric timestamps in the current
 * protocol, but we can warn about their interpretation
 */
function validateTimestampBoundary(event: WorldEvent): void {
  // Timestamps are currently numeric in the protocol (legacy)
  // This validator documents the correct interpretation

  // ULID event_id already encodes time and should be used for ordering
  // The numeric timestamp field should only be used for:
  // 1. Human-readable display
  // 2. Derived projections (analytics, timelines)
  // 3. Never for authoritative LWW ordering

  // We don't throw an error here, just document the principle
  // Actual enforcement would require protocol migration
}

// ============================================================================
// Full Boundary Validation
// ============================================================================

/**
 * Validates that an event respects the symbolic/numeric boundary
 *
 * This is the main entry point for boundary validation.
 * Call this AFTER standard protocol validation.
 *
 * @param event - A valid WorldEvent (already passed validateWorldEvent)
 * @throws ValidationError if boundary rules are violated
 */
export function validateBoundary(event: WorldEvent): void {
  // Validate timestamp interpretation (informational only)
  validateTimestampBoundary(event);

  // Operation-specific boundary validation
  if (isCreateNodeEvent(event)) {
    validateCreateNodeBoundary(event);
  } else if (isUpdateTransformEvent(event)) {
    validateUpdateTransformBoundary(event);
  } else if (isPhysicsStepEvent(event)) {
    validatePhysicsStepBoundary(event);
  } else if (event.operation === "derived_feature32") {
    validateDerivedFeature32Boundary(event as DerivedFeature32Event);
  } else if (event.operation === "set_media") {
    validateSetMediaBoundary(event as SetMediaEvent);
  }

  // Add more operation-specific validators as needed
}

/**
 * Validates a batch of events for boundary compliance
 *
 * @param events - Array of valid WorldEvents
 * @throws ValidationError with all boundary violations
 */
export function validateBoundaryBatch(events: WorldEvent[]): void {
  const errors: Array<{ index: number; error: ValidationError }> = [];

  for (let i = 0; i < events.length; i++) {
    try {
      validateBoundary(events[i]);
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
      error.problems.map(p => `Event ${index} [${events[index].operation}]: ${p}`)
    );
    throw new ValidationError(problems);
  }
}

// ============================================================================
// Helper: Check if Event is Symbolic (for testing/debugging)
// ============================================================================

/**
 * Returns true if an event contains only symbolic data (no numeric measurements)
 * Useful for testing and debugging
 */
export function isSymbolicEvent(event: WorldEvent): boolean {
  try {
    validateBoundary(event);
    return true;
  } catch (err) {
    if (err instanceof ValidationError) {
      return false;
    }
    throw err;
  }
}

/**
 * Returns a report of boundary issues (non-throwing version)
 * Useful for linting and reporting
 */
export function analyzeBoundary(event: WorldEvent): {
  isSymbolic: boolean;
  issues: string[];
} {
  try {
    validateBoundary(event);
    return { isSymbolic: true, issues: [] };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { isSymbolic: false, issues: err.problems };
    }
    throw err;
  }
}
