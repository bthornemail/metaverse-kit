# Projector Examples: Symbolic → Numeric Projections

This directory contains reference implementations demonstrating the **symbolic/numeric boundary** in practice.

## What's Here

### 1. `graph-builder.ts`

Utility for extracting pure symbolic graph structure from World Events.

**What it does**:
- Reads World Events (source authority)
- Builds graph with nodes, edges, properties
- Provides query functions (neighbors, paths, distance)
- Computes combinatorial statistics

**What it does NOT do**:
- Interpret numeric coordinates
- Compute positions or layouts
- Store any numeric measurements

**Usage**:
```typescript
import { buildSymbolicGraph, findPath, graphDistance } from "./graph-builder.js";

const graph = buildSymbolicGraph(events);

// Query symbolic graph
const neighbors = getNeighbors(graph, "node:A");
const path = findPath(graph, "node:A", "node:B");
const distance = graphDistance(graph, "node:A", "node:B"); // BFS hop count

// Get statistics
const stats = computeStats(graph);
console.log(`Graph has ${stats.nodeCount} nodes, ${stats.edgeCount} edges`);
```

---

### 2. `spring-layout-2d.ts`

Force-directed layout projector that converts symbolic graph to 2D numeric positions.

**What it does**:
- Reads symbolic graph (no coordinates)
- Computes 2D positions via spring simulation
- Emits derived events with `authority: derived`
- Is deterministic (same graph → same layout)

**Key Properties**:
- ✅ Deterministic (seeded from node IDs)
- ✅ Idempotent (same input → same output)
- ✅ Boundary-compliant (only derived authority)

**Usage**:
```typescript
import { projectPipeline } from "./spring-layout-2d.js";

const derivedEvents = projectPipeline(sourceEvents, {
  space_id: "demo",
  tile_id: "z0/x0/y0",
  actor_id: "projector:spring_v1",
  layout: {
    iterations: 100,
    springLength: 100,
    repulsionConstant: 1000,
  }
});

// All derived events have authority: derived
for (const event of derivedEvents) {
  console.log(event.for_node, event.transform.position);
}
```

---

### 3. `complete-example.ts`

End-to-end demonstration of the symbolic → projection → view pipeline.

**What it does**:
1. Creates symbolic events (nodes + links, no coordinates)
2. Validates events against boundary rules
3. Builds symbolic graph and shows statistics
4. Projects graph to numeric 2D layout
5. Validates derived events
6. Demonstrates boundary violations (what NOT to do)

**Run it**:
```bash
cd dev-docs/examples/projectors
npx tsx complete-example.ts
```

**Expected Output**:
```
═══════════════════════════════════════════════════════
  COMPLETE EXAMPLE: Symbolic → Projection → View
═══════════════════════════════════════════════════════

📝 Created 10 symbolic events

🔍 Validating symbolic events...
✓ Event evt-create-node:A - protocol valid
✓ Event evt-create-node:A - boundary compliant
...

📊 Building symbolic graph...
Graph Statistics (Combinatorial Properties):
  Nodes: 5
  Edges: 5
  Components: 1
  Relations: connected

🎨 Projecting to numeric 2D layout...
✓ Generated 5 derived events
✓ node:A: position [120.5, -45.2]
✓ node:B: position [85.3, 60.1]
...

❌ Demonstrating boundary violation...
✓ Boundary violation detected:
  create_node with authority:source cannot contain numeric transforms...

💡 Key Insights:
1. SYMBOLIC EVENTS (source authority):
   - Create nodes with identity transforms only
   - Link nodes with symbolic relations
   ...
```

---

## Quick Start

### Install Dependencies

```bash
npm install @metaverse-kit/protocol
```

### Run Complete Example

```bash
cd dev-docs/examples/projectors
npx tsx complete-example.ts
```

### Use in Your Code

```typescript
// 1. Import utilities
import { buildSymbolicGraph } from "./graph-builder.js";
import { projectPipeline } from "./spring-layout-2d.js";

// 2. Build symbolic graph from events
const graph = buildSymbolicGraph(sourceEvents);

// 3. Project to numeric layout
const derivedEvents = projectPipeline(sourceEvents, {
  space_id: "my-space",
  tile_id: "z0/x0/y0",
  actor_id: "projector:spring",
});

// 4. Use derived events for rendering
renderCanvas(derivedEvents);
```

---

## Key Patterns

### Pattern 1: Symbolic Graph Extraction

```typescript
// Read source events → build graph
const graph = buildSymbolicGraph(events.filter(
  e => e.scope.authority === "source"
));

// Query graph symbolically
const connected = getConnected(graph, nodeId);
const distance = graphDistance(graph, nodeA, nodeB); // Hop count
```

### Pattern 2: Deterministic Projection

```typescript
// Seed from graph structure (deterministic)
const seed = hashString(
  Array.from(graph.nodes.keys()).sort().join(",")
);

// Run fixed iterations (no convergence threshold)
for (let i = 0; i < MAX_ITERATIONS; i++) {
  stepSimulation();
}
```

### Pattern 3: Derived Event Emission

```typescript
// Always set authority: derived
const derivedEvent = {
  ...envelope,
  scope: { authority: "derived", ... },
  transform: numericTransform, // Allowed in derived
};

// Validate boundary compliance
validateBoundary(derivedEvent); // Should pass
```

---

## Testing Your Projector

### Test 1: Idempotence

```typescript
test("projector is idempotent", () => {
  const output1 = project(events);
  const output2 = project(events);
  expect(output1).toEqual(output2);
});
```

### Test 2: Determinism

```typescript
test("projector is deterministic across processes", async () => {
  const output1 = await runInWorker(project, events);
  const output2 = await runInWorker(project, events);
  expect(output1).toEqual(output2);
});
```

### Test 3: Boundary Compliance

```typescript
test("projector outputs only derived authority", () => {
  const output = project(events);
  for (const event of output) {
    expect(event.scope.authority).toBe("derived");
  }
});
```

### Test 4: Symbolic Input Only

```typescript
test("projector works with symbolic events only", () => {
  const symbolicEvents = events.filter(
    e => e.scope.authority === "source" &&
         !hasNumericTransform(e)
  );
  const output = project(symbolicEvents);
  expect(output.length).toBeGreaterThan(0);
});
```

---

## Common Mistakes

### ❌ WRONG: Numeric coordinates in source authority

```typescript
{
  operation: "create_node",
  scope: { authority: "source" },
  transform: { position: [100, 200, 0] } // ❌ Violation
}
```

### ✅ CORRECT: Identity transform in source authority

```typescript
{
  operation: "create_node",
  scope: { authority: "source" },
  transform: { position: [0, 0, 0] } // ✓ Identity
}

// Then link symbolically:
{
  operation: "link_nodes",
  scope: { authority: "source" },
  from_node: "node:A",
  relation: "adjacent",
  to_node: "node:B"
}
```

### ❌ WRONG: Numeric transform in source authority

```typescript
{
  operation: "update_transform",
  scope: { authority: "source" }, // ❌ Violation
  transform: { position: [100, 200, 0] }
}
```

### ✅ CORRECT: Numeric transform in derived authority

```typescript
{
  operation: "project_layout_spring",
  scope: { authority: "derived" }, // ✓ Correct
  transform: { position: [100, 200, 0] }
}
```

---

## Further Reading

- [SYMBOLIC_NUMERIC_AUDIT.md](../../SYMBOLIC_NUMERIC_AUDIT.md) - Full protocol audit
- [PROJECTION_PATTERNS.md](../../PROJECTION_PATTERNS.md) - Projection patterns for all view types
- [BOUNDARY_VALIDATION.md](../../../packages/protocol/BOUNDARY_VALIDATION.md) - Validation layer docs
- [CLAUDE.md](../../../CLAUDE.md) - Project philosophy

---

## Next Steps

1. **Implement your own projector** using these examples as templates
2. **Test for determinism** - same input must produce same output
3. **Validate boundary compliance** - use `validateBoundary()` on all output
4. **Document your algorithm** - explain the projection clearly

Remember: **Symbolic core, numeric projections** - this is the foundation of the entire system.
