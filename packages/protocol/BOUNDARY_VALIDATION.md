# Symbolic/Numeric Boundary Validation

This module enforces the core architectural principle of Metaverse Kit:

**Numeric measurements must never appear in source authority events.**

## Quick Start

```typescript
import {
  validateWorldEvent,
  validateBoundary,
  analyzeBoundary
} from "@metaverse-kit/protocol";

// Standard protocol validation
const event = validateWorldEvent(rawEvent);

// Boundary validation (enforces symbolic/numeric separation)
validateBoundary(event); // Throws ValidationError if violated

// Or get a report without throwing
const report = analyzeBoundary(event);
if (!report.isSymbolic) {
  console.warn("Boundary violations:", report.issues);
}
```

## The Core Principle

```
SYMBOLIC CORE (authority: source)
    ↓ (one-way only)
NUMERIC PROJECTIONS (authority: derived)
    ↓
VIEWS (ephemeral, not stored)
```

### Allowed in Source Authority

✅ **Symbolic atoms** - IDs, mnemonics, content hashes
✅ **Counts and indices** - Combinatorial properties (vertex count, bucket index)
✅ **Relations** - Graph connections (neighbors, parent, constraints)

### Prohibited in Source Authority

❌ **Coordinates** - x/y/z positions, offsets
❌ **Rotations** - Quaternions, Euler angles
❌ **Scales** - Numeric scaling factors
❌ **Time measurements** - Numeric timestamps, durations (for ordering)

## Examples

### ❌ WRONG: Numeric coordinates in source authority

```typescript
{
  "operation": "create_node",
  "scope": {"authority": "source"},
  "transform": {
    "position": [100, 200, 0],  // ❌ Numeric measurement
    "rotation_quat": [0, 0, 0, 1],
    "scale": [1, 1, 1]
  }
}
// This will FAIL boundary validation
```

### ✅ CORRECT: Symbolic relations in source authority

```typescript
{
  "operation": "create_node",
  "scope": {"authority": "source"},
  "node_id": "node:abc123",
  "kind": "element",
  "transform": {
    "position": [0, 0, 0],      // ✓ Identity (no numeric meaning)
    "rotation_quat": [0, 0, 0, 1],
    "scale": [1, 1, 1]
  }
}

// Then express spatial relations symbolically:
{
  "operation": "link_nodes",
  "scope": {"authority": "source"},
  "from_node": "node:abc123",
  "relation": "adjacent",  // ✓ Symbolic spatial relation
  "to_node": "node:def456"
}
```

### ✅ CORRECT: Numeric transforms in derived authority

```typescript
{
  "operation": "physics_step",
  "scope": {"authority": "derived"}, // ✓ Explicitly derived
  "solver": "spring_layout_v1",
  "tick": 42,
  "delta_time": 16.67,
  "updates": [{
    "node_id": "node:abc123",
    "transform": {
      "position": [100, 200, 0],  // ✓ Allowed (derived projection)
      "rotation_quat": [0, 0, 0, 1],
      "scale": [1, 1, 1]
    }
  }]
}
// This will PASS boundary validation
```

## Operation-Specific Rules

### create_node

- **Source authority**: Only identity transforms allowed
  - `position: [0, 0, 0]`
  - `rotation_quat: [0, 0, 0, 1]`
  - `scale: [1, 1, 1]`
- **Derived authority**: Any numeric transform allowed

### update_transform

- **Source authority**: PROHIBITED (use link_nodes instead)
- **Derived authority**: Any numeric transform allowed

### physics_step

- **Must have** `authority: derived`
- Can contain any numeric transforms (they're projections)

### derived_feature32

- **Must have** `authority: derived`
- Features are bucket indices (0..15), which are symbolic

### link_nodes / unlink_nodes

- **Recommended for** expressing spatial relations symbolically
- Use relations like:
  - `"adjacent"` - next to each other
  - `"parent"` - hierarchical containment
  - `"connected"` - generic connection

## Migration Guide

### From Numeric to Symbolic

**Before (numeric authority - violates boundary):**
```typescript
// Client drags node to new position
const dragEvent = {
  operation: "update_transform",
  scope: { authority: "source" },
  node_id: nodeId,
  transform: {
    position: [newX, newY, 0],
    rotation_quat: [0, 0, 0, 1],
    scale: [1, 1, 1]
  }
};
```

**After (symbolic authority - correct):**
```typescript
// Client links node to new neighbor
const linkEvent = {
  operation: "link_nodes",
  scope: { authority: "source" },
  from_node: nodeId,
  relation: "near",
  to_node: targetNodeId
};

// Projector computes layout from graph
const layoutEvent = {
  operation: "project_layout_spring",
  scope: { authority: "derived" },
  solver: "spring_v1",
  updates: [
    { node_id: nodeId, transform: { position: [newX, newY, 0], ... } }
  ]
};
```

## Validation in Your Pipeline

### Server-Side (Tile Store)

```typescript
import { validateWorldEvent, validateBoundary } from "@metaverse-kit/protocol";

export function appendEvents(events: unknown[]): AppendEventsResponse {
  const validated = events.map(ev => {
    const event = validateWorldEvent(ev);  // Protocol validation
    validateBoundary(event);                 // Boundary validation
    return event;
  });

  // Store validated events...
}
```

### Client-Side (Before Sending)

```typescript
import { validateBoundary, analyzeBoundary } from "@metaverse-kit/protocol";

export function sendEvent(event: WorldEvent) {
  const report = analyzeBoundary(event);

  if (!report.isSymbolic) {
    console.error("Boundary violation - event will be rejected:", report.issues);
    throw new Error("Cannot send event with numeric authority");
  }

  // Send symbolic event to server...
}
```

### Linting / Pre-Commit Hooks

```typescript
import { analyzeBoundary } from "@metaverse-kit/protocol";
import fs from "fs";

// Lint event trace files
const events = JSON.parse(fs.readFileSync("trace.jsonl", "utf8"));
const violations = events
  .map((ev, i) => ({ index: i, report: analyzeBoundary(ev) }))
  .filter(({ report }) => !report.isSymbolic);

if (violations.length > 0) {
  console.error("Boundary violations found:");
  violations.forEach(({ index, report }) => {
    console.error(`Event ${index}:`, report.issues);
  });
  process.exit(1);
}
```

## Rationale

### Why This Matters

1. **Deterministic Replay**: Symbolic events compose idempotently. Numeric transforms depend on evaluation order.

2. **Multi-Projector Support**: Same symbolic events → different numeric projections (2D canvas, 3D scene, VR, map view).

3. **Scale Independence**: Symbolic graph works on ESP32 and cloud. Numeric sim requires compute.

4. **Offline-First**: Clients send lightweight symbolic events, projectors run server-side or lazily.

5. **Auditability**: Symbolic events are human-readable intent. Numeric transforms are opaque.

### When Numbers Are Okay

Numbers are fine when they're:

1. **Symbolic atoms** - IDs, counts, bucket indices (e.g., BASIS32 features)
2. **Derived projections** - Physics sims, layout algorithms (authority: derived)
3. **Intrinsic metadata** - Image width/height from file headers
4. **Ephemeral UI state** - Cursor positions, viewport zoom (not stored)

### When Numbers Are Wrong

Numbers violate the boundary when they're:

1. **Spatial measurements** - Coordinates, distances, angles (in source authority)
2. **Temporal measurements** - Timestamps for ordering (use ULID event_id instead)
3. **Authoritative state** - Anything that replay must reproduce exactly

## Further Reading

- [SYMBOLIC_NUMERIC_AUDIT.md](../../dev-docs/SYMBOLIC_NUMERIC_AUDIT.md) - Full audit of current protocol
- [CLAUDE.md](../../CLAUDE.md) - Overall project philosophy
- [Ideal Idols Framework](../../dev-docs/Ideal Idols Identites Idempotence/README.md) - Pure combinatorial geometry
