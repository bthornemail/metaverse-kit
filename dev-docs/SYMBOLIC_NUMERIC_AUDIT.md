# Symbolic/Numeric Boundary Audit

**Date**: 2026-01-11
**Auditor**: Claude Code
**Scope**: Metaverse Kit event protocol and type system

## Executive Summary

This audit identifies places where **numeric values are stored with `authority: source`**, violating the symbolic core / numeric projection boundary. The current protocol allows numeric coordinates and transforms to be written as authoritative truth, when they should only exist as derived projections.

**Verdict**: 🔴 **Multiple violations found** - requires protocol refinement

---

## Core Principle (Reminder)

```
SYMBOLIC CORE (authority: source)
    ↓ (one-way only)
NUMERIC PROJECTIONS (authority: derived)
    ↓
VIEWS (ephemeral, not stored)
```

**Rule**: Numbers in source authority events must be symbolic atoms (IDs, mnemonics, counts), never measurements (coordinates, angles, scales).

---

## Violations Found

### 🔴 CRITICAL: Transform Interface (types.ts:45-49)

**Location**: `packages/protocol/src/types.ts`

```typescript
export interface Transform {
  position: [number, number, number];        // ❌ Numeric coordinates
  rotation_quat: [number, number, number, number]; // ❌ Numeric rotation
  scale: [number, number, number];           // ❌ Numeric scale
}
```

**Used By** (all with `authority: source` by default):
- `CreateNodeEvent` (line 102-108)
- `UpdateTransformEvent` (line 110-114)
- `Snapshot.nodes[].transform` (line 276)

**Impact**: **CRITICAL**
This is the core violation. Transforms encode numeric measurements as authoritative truth.

**What It Should Be**:
```typescript
// Symbolic transform (relations only)
export interface SymbolicTransform {
  neighbors: NodeId[];           // Adjacency relations
  parent?: NodeId;               // Hierarchical relation
  constraints?: Constraint[];    // Symbolic constraints
}

// Numeric transform (projections only)
export interface NumericTransform {
  position: [number, number, number];
  rotation_quat: [number, number, number, number];
  scale: [number, number, number];
}
```

**Fix Strategy**:
1. Rename current `Transform` → `NumericTransform`
2. Create new `SymbolicTransform` for source events
3. Move numeric transforms to derived events only
4. Update all operations to use symbolic relations

---

### 🔴 CRITICAL: EventEnvelope.timestamp (types.ts:66)

**Location**: `packages/protocol/src/types.ts`

```typescript
export interface EventEnvelope {
  timestamp: number; // ❌ Numeric time measurement
  // ...
}
```

**Impact**: **CRITICAL**
Timestamp is used for LWW ordering, treating time as a numeric measurement.

**What It Should Be**:
```typescript
export interface EventEnvelope {
  timestamp: string; // ✓ Symbolic causal atom (ULID already encodes time)
  // Or simply rely on event_id ordering (ULIDs are time-sortable)
}
```

**Fix Strategy**:
1. Use `event_id` (ULID) for causal ordering - it already encodes time
2. If numeric timestamp needed, compute it on-demand from ULID
3. Never compare timestamps numerically in core logic
4. Use graph topological ordering for causality

---

### 🔴 HIGH: PhysicsStepEvent (types.ts:200-206)

**Location**: `packages/protocol/src/types.ts`

```typescript
export interface PhysicsStepEvent extends EventEnvelope {
  operation: "physics_step";
  solver: string;
  tick: number;           // ❌ Numeric tick counter
  delta_time: number;     // ❌ Numeric time delta
  updates: Array<{
    node_id: NodeId;
    transform: Transform; // ❌ Numeric transforms
  }>;
}
```

**Impact**: **HIGH**
Physics events should ALWAYS have `authority: derived`, but the type doesn't enforce it.

**Current State**: ⚠️ Partially correct
- These events are intended to be derived
- But type system doesn't enforce authority boundary

**What It Should Be**:
```typescript
// Enforce derived authority at type level
export interface PhysicsStepEvent extends EventEnvelope {
  operation: "physics_step";
  scope: Scope & { authority: "derived" }; // ✓ Enforce derived
  solver: string;
  tick: number;        // ✓ Acceptable (symbolic tick atom)
  delta_time: number;  // ✓ Acceptable (symbolic delta atom)
  updates: Array<{
    node_id: NodeId;
    transform: NumericTransform; // ✓ Clearly numeric projection
  }>;
}
```

**Fix Strategy**:
1. Add type constraint: `scope.authority` must be `"derived"`
2. Use `NumericTransform` (explicit projection type)
3. Validate authority in `validatePhysicsStep` (currently missing)

---

### 🔴 MEDIUM: DerivedFeature32Event.features (types.ts:220)

**Location**: `packages/protocol/src/types.ts`

```typescript
export interface DerivedFeature32Event extends EventEnvelope {
  operation: "derived_feature32";
  features: number[]; // ⚠️ Should be symbolic buckets, not floats
  // ...
}
```

**Impact**: **MEDIUM**
Features are stored as numeric array, but should be symbolic signatures.

**Current State**: ✓ Partial fix
- Validation enforces `authority: derived` (validate.ts:502-505)
- Features constrained to 0..15 range (symbolic buckets)

**What It Should Be**:
```typescript
export interface DerivedFeature32Event extends EventEnvelope {
  operation: "derived_feature32";
  scope: Scope & { authority: "derived" }; // ✓ Already validated
  features: number[];  // ✓ Actually okay - these are bucket indices (0..15)
  packed64?: string;   // ✓ Hex representation (symbolic)
  packed128?: [string, string]; // ✓ Hex representation (symbolic)
}
```

**Fix Strategy**:
1. Add type constraint for authority (like PhysicsStepEvent)
2. Document that `features` are symbolic bucket indices, not measurements
3. Consider renaming to `buckets` for clarity

---

### 🟡 LOW: SetMediaEvent.media.meta (types.ts:164-169)

**Location**: `packages/protocol/src/types.ts`

```typescript
export interface SetMediaEvent extends EventEnvelope {
  operation: "set_media";
  media: {
    meta?: {
      width?: number;    // ⚠️ Numeric measurement
      height?: number;   // ⚠️ Numeric measurement
      duration?: number; // ⚠️ Numeric measurement
    };
  };
}
```

**Impact**: **LOW**
Media metadata contains numeric measurements, but they're metadata, not spatial truth.

**Current State**: ⚠️ Ambiguous
- Could be acceptable (intrinsic media properties)
- Could be violations (spatial measurements)

**Fix Strategy**:
1. If intrinsic (from file headers): ✓ Acceptable
2. If measured/projected: Should be in derived events
3. Document that these are intrinsic media properties, not world measurements

---

### 🟡 LOW: PresenceUpdate (types.ts:344-355)

**Location**: `packages/protocol/src/types.ts`

```typescript
export interface PresenceUpdate {
  position?: [number, number, number]; // ⚠️ Numeric position
  viewport?: {
    center: [number, number]; // ⚠️ Numeric viewport
    zoom: number;             // ⚠️ Numeric zoom
  };
}
```

**Impact**: **LOW**
Presence is ephemeral (not stored in ledger), so numeric projections are acceptable.

**Current State**: ✓ Acceptable
- Clearly marked as ephemeral
- Never written to event ledger
- Used only for real-time UI state

**Fix Strategy**:
- No changes needed
- Document that presence is projection-only

---

## Validation Gaps

### Missing Authority Enforcement

**Location**: `packages/protocol/src/validate.ts`

The following operations allow `authority: source` but contain numeric data:

1. **create_node** (line 208-228): Accepts Transform with source authority
2. **update_transform** (line 231-248): Accepts Transform with source authority
3. **physics_step** (line 431-468): Doesn't enforce `authority: derived`
4. **set_geometry** (line 308-335): Accepts numeric `units` metadata

**What's Missing**:
```typescript
function validateCreateNode(obj: Record<string, unknown>): void {
  // ... existing validation ...

  // ❌ MISSING: Should reject numeric transforms in source authority
  if (obj["scope"].authority === "source" && hasNumericTransform(obj)) {
    problems.push("create_node with authority:source cannot contain numeric transforms");
  }
}
```

---

## Summary Table

| Violation | Severity | Location | Source Auth? | Fix Required |
|-----------|----------|----------|--------------|--------------|
| Transform interface | 🔴 CRITICAL | types.ts:45 | Yes | Replace with symbolic relations |
| timestamp field | 🔴 CRITICAL | types.ts:66 | Yes | Use ULID ordering instead |
| PhysicsStepEvent | 🔴 HIGH | types.ts:200 | Intended no, not enforced | Add authority constraint |
| DerivedFeature32 | 🔴 MEDIUM | types.ts:220 | No (enforced) | Document as symbolic buckets |
| Media metadata | 🟡 LOW | types.ts:164 | Ambiguous | Clarify intrinsic vs measured |
| PresenceUpdate | 🟡 LOW | types.ts:344 | No (ephemeral) | No fix needed |

---

## Recommendations

### Phase 1: Type System Refinement (Breaking Changes)

1. **Split Transform Types**:
   - `SymbolicTransform` (neighbors, constraints) for source events
   - `NumericTransform` (position, rotation, scale) for derived events

2. **Remove Numeric Timestamp**:
   - Use `event_id` (ULID) for ordering
   - Compute timestamp on-demand if needed for projection

3. **Add Authority Constraints**:
   - `PhysicsStepEvent`: Enforce `authority: derived` at type level
   - `DerivedFeature32Event`: Enforce `authority: derived` at type level

### Phase 2: Validation Layer Enhancement (Non-Breaking)

1. **Add Authority Boundary Checks**:
   - Reject numeric transforms in source authority events
   - Enforce derived authority for physics/feature events

2. **Add Symbolic Validation**:
   - Validate that relations reference existing nodes
   - Validate graph connectivity constraints

### Phase 3: Migration Path

1. **Create Adapter Layer**:
   - Convert legacy numeric events to symbolic relations
   - Generate derived projection events for compatibility

2. **Update Projectors**:
   - Read symbolic core events
   - Compute numeric transforms as projections
   - Emit derived events with numeric data

3. **Update Clients**:
   - Send symbolic events (link_nodes, not update_transform)
   - Receive derived projection events for rendering

---

## Next Steps

1. ✅ **Audit complete** - violations identified
2. ⏳ **Create validation layer** - enforce boundaries
3. ⏳ **Document projection patterns** - show correct usage
4. ⏳ **Update CLAUDE.md** - codify principles
5. ⏳ **Build examples** - demonstrate symbolic-to-numeric flow

---

## Appendix: Symbolic vs Numeric Examples

### ❌ Current (Numeric Authority)

```json
{
  "operation": "create_node",
  "scope": {"authority": "source"},
  "transform": {
    "position": [100, 200, 0],
    "rotation_quat": [0, 0, 0, 1],
    "scale": [1, 1, 1]
  }
}
```

### ✅ Correct (Symbolic Authority)

```json
{
  "operation": "create_node",
  "scope": {"authority": "source"},
  "relations": {
    "neighbors": ["node:abc", "node:def"],
    "parent": "node:xyz"
  }
}
```

### ✅ Projection (Derived Authority)

```json
{
  "operation": "project_layout_2d",
  "scope": {"authority": "derived"},
  "for_node": "node:123",
  "transform": {
    "position": [100, 200, 0],
    "rotation_quat": [0, 0, 0, 1],
    "scale": [1, 1, 1]
  }
}
```
