# Projection Patterns: Symbolic → Numeric Views

**Date**: 2026-01-11
**Scope**: How to correctly project symbolic events into 2D/3D/AR/VR numeric views

## Overview

Projectors transform symbolic graph structure (source authority) into numeric visualizations (derived authority). This document defines standard patterns for implementing projectors across all view types.

## Core Pattern

```
Symbolic Events (stdin) → Projector (WASM/worker) → Numeric View (stdout)
                              ↓
                    Boundary Logs (stderr)
```

### Universal Projector Interface

All projectors follow this contract:

```typescript
interface Projector {
  // Read symbolic events from trace
  input: ReadableStream<WorldEvent>;

  // Compute numeric projection
  project(events: WorldEvent[]): ProjectionOutput;

  // Write derived events with numeric data
  output: WritableStream<DerivedEvent>;

  // Log boundary violations and warnings
  errors: WritableStream<string>;
}
```

### POSIX/Command-Line Interface

```bash
# Standard projector invocation
cat trace.jsonl | projector-2d --observer observer.yaml > view2d.jsonl 2> boundary.log

# With options
cat trace.jsonl | projector-3d --solver spring --iterations 100 > view3d.jsonl

# Chained projections
cat trace.jsonl | projector-layout | projector-render-2d > canvas.json
```

---

## Projection Type 1: Graph Layout (2D Canvas)

**Input**: Symbolic graph (nodes + edges)
**Output**: Numeric 2D positions
**Algorithm**: Force-directed layout, spring simulation, or explicit graph layout

### Example: Spring Layout Projector

**Input Events** (symbolic):
```jsonl
{"operation":"create_node","node_id":"node:A","scope":{"authority":"source"},...}
{"operation":"create_node","node_id":"node:B","scope":{"authority":"source"},...}
{"operation":"link_nodes","from_node":"node:A","relation":"adjacent","to_node":"node:B","scope":{"authority":"source"},...}
```

**Projection Algorithm**:
```typescript
// projector-layout-spring.ts
import { WorldEvent } from "@metaverse-kit/protocol";

interface GraphNode {
  id: NodeId;
  neighbors: Set<NodeId>;
}

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function projectSpringLayout(
  events: WorldEvent[],
  options: {
    iterations: number;
    springK: number;
    repelK: number;
    damping: number;
  }
): Map<NodeId, [number, number]> {
  // 1. Build symbolic graph
  const graph = buildGraph(events);

  // 2. Initialize random positions (seed from node IDs for determinism)
  const layout = initializeLayout(graph);

  // 3. Run spring simulation
  for (let i = 0; i < options.iterations; i++) {
    stepSpringForces(layout, options);
  }

  // 4. Return numeric positions
  return new Map(
    layout.map(node => [node.id, [node.x, node.y]])
  );
}

function buildGraph(events: WorldEvent[]): GraphNode[] {
  const nodes = new Map<NodeId, GraphNode>();

  for (const ev of events) {
    if (ev.operation === "create_node") {
      nodes.set(ev.node_id, { id: ev.node_id, neighbors: new Set() });
    } else if (ev.operation === "link_nodes") {
      nodes.get(ev.from_node)?.neighbors.add(ev.to_node);
      nodes.get(ev.to_node)?.neighbors.add(ev.from_node);
    }
  }

  return Array.from(nodes.values());
}

function stepSpringForces(layout: LayoutNode[], opts: any): void {
  // Spring attraction between connected nodes
  for (const node of layout) {
    for (const neighborId of node.neighbors) {
      const neighbor = layout.find(n => n.id === neighborId);
      if (!neighbor) continue;

      const dx = neighbor.x - node.x;
      const dy = neighbor.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const force = opts.springK * (dist - 100); // Rest length = 100
      node.vx += (dx / dist) * force;
      node.vy += (dy / dist) * force;
    }
  }

  // Coulomb repulsion between all nodes
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i];
      const b = layout[j];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy || 1;

      const force = opts.repelK / distSq;
      a.vx -= (dx / Math.sqrt(distSq)) * force;
      a.vy -= (dy / Math.sqrt(distSq)) * force;
      b.vx += (dx / Math.sqrt(distSq)) * force;
      b.vy += (dy / Math.sqrt(distSq)) * force;
    }
  }

  // Update positions with damping
  for (const node of layout) {
    node.vx *= opts.damping;
    node.vy *= opts.damping;
    node.x += node.vx;
    node.y += node.vy;
  }
}
```

**Output Events** (derived):
```jsonl
{"operation":"project_layout_spring","scope":{"authority":"derived"},"solver":"spring_v1","node_id":"node:A","transform":{"position":[150.2,200.5,0],"rotation_quat":[0,0,0,1],"scale":[1,1,1]},...}
{"operation":"project_layout_spring","scope":{"authority":"derived"},"solver":"spring_v1","node_id":"node:B","transform":{"position":[250.8,200.1,0],"rotation_quat":[0,0,0,1],"scale":[1,1,1]},...}
```

**Key Properties**:
- Deterministic (seed from node IDs)
- Idempotent (same graph → same layout)
- No feedback to source authority

---

## Projection Type 2: 3D Scene Graph (Three.js/WebGL)

**Input**: Symbolic graph + optional geometry refs
**Output**: 3D transforms + material bindings
**Algorithm**: Hierarchical scene graph projection

### Example: 3D Scene Projector

**Input Events** (symbolic):
```jsonl
{"operation":"create_node","node_id":"node:root","kind":"group",...}
{"operation":"create_node","node_id":"node:box","kind":"primitive.box",...}
{"operation":"link_nodes","from_node":"node:root","relation":"parent","to_node":"node:box",...}
{"operation":"set_geometry","node_id":"node:box","geometry":{"kind":"glb","ref":"sha256:abc123"},...}
```

**Projection Algorithm**:
```typescript
// projector-3d-scene.ts
import * as THREE from "three";

interface SceneNode {
  id: NodeId;
  kind: string;
  parent?: NodeId;
  children: Set<NodeId>;
  geometry?: GeometryRef;
}

export function project3DScene(
  events: WorldEvent[],
  assetLoader: AssetLoader
): THREE.Scene {
  const scene = new THREE.Scene();
  const nodes = buildSceneGraph(events);

  // First pass: create Three.js objects
  const objects = new Map<NodeId, THREE.Object3D>();
  for (const node of nodes.values()) {
    const obj = createObject3D(node, assetLoader);
    objects.set(node.id, obj);
  }

  // Second pass: build hierarchy
  for (const node of nodes.values()) {
    const obj = objects.get(node.id)!;
    if (node.parent) {
      const parentObj = objects.get(node.parent);
      parentObj?.add(obj);
    } else {
      scene.add(obj);
    }
  }

  // Third pass: compute layout from graph topology
  const layout = computeHierarchicalLayout(nodes);
  for (const [id, transform] of layout) {
    const obj = objects.get(id);
    if (obj) {
      obj.position.set(...transform.position);
      obj.quaternion.set(...transform.rotation_quat);
      obj.scale.set(...transform.scale);
    }
  }

  return scene;
}

function computeHierarchicalLayout(
  nodes: Map<NodeId, SceneNode>
): Map<NodeId, NumericTransform> {
  const layout = new Map<NodeId, NumericTransform>();

  // Root nodes at origin
  const roots = Array.from(nodes.values()).filter(n => !n.parent);
  for (const root of roots) {
    layout.set(root.id, identityTransform());
    layoutChildren(root, nodes, layout, 0);
  }

  return layout;
}

function layoutChildren(
  parent: SceneNode,
  nodes: Map<NodeId, SceneNode>,
  layout: Map<NodeId, NumericTransform>,
  depth: number
): void {
  const children = Array.from(parent.children);
  const angleStep = (2 * Math.PI) / children.length;

  children.forEach((childId, i) => {
    const child = nodes.get(childId);
    if (!child) return;

    const angle = i * angleStep;
    const radius = 2 + depth; // Spiral outward with depth

    layout.set(child.id, {
      position: [
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        -depth
      ],
      rotation_quat: [0, 0, 0, 1],
      scale: [1, 1, 1]
    });

    layoutChildren(child, nodes, layout, depth + 1);
  });
}
```

**Output Events** (derived):
```jsonl
{"operation":"project_3d_scene","scope":{"authority":"derived"},"node_id":"node:root","transform":{"position":[0,0,0],"rotation_quat":[0,0,0,1],"scale":[1,1,1]},...}
{"operation":"project_3d_scene","scope":{"authority":"derived"},"node_id":"node:box","transform":{"position":[2,0,-1],"rotation_quat":[0,0,0,1],"scale":[1,1,1]},...}
```

---

## Projection Type 3: AR/VR World (WebXR)

**Input**: Symbolic graph + real-world anchors
**Output**: XR-space transforms + hand tracking
**Algorithm**: Anchor-based alignment + gesture projection

### Example: AR Anchor Projector

**Input Events** (symbolic):
```jsonl
{"operation":"create_node","node_id":"node:desk","kind":"anchor.surface",...}
{"operation":"create_node","node_id":"node:model","kind":"model.3d",...}
{"operation":"link_nodes","from_node":"node:model","relation":"anchored_to","to_node":"node:desk",...}
{"operation":"set_properties","node_id":"node:desk","properties":{"ar_anchor_id":"uuid-anchor-123"},...}
```

**Projection Algorithm**:
```typescript
// projector-ar-webxr.ts
import { XRFrame, XRReferenceSpace, XRAnchor } from "webxr";

export async function projectARScene(
  events: WorldEvent[],
  xrFrame: XRFrame,
  referenceSpace: XRReferenceSpace
): Promise<Map<NodeId, XRPose>> {
  const graph = buildGraph(events);
  const poses = new Map<NodeId, XRPose>();

  // Find anchor nodes
  const anchors = graph.filter(n => n.kind.startsWith("anchor."));

  for (const anchor of anchors) {
    // Get AR anchor from device
    const xrAnchor = await resolveXRAnchor(anchor, xrFrame);
    if (!xrAnchor) continue;

    // Project anchor to XR space
    const anchorPose = xrFrame.getPose(xrAnchor.anchorSpace, referenceSpace);
    if (!anchorPose) continue;

    poses.set(anchor.id, anchorPose);

    // Project children relative to anchor
    for (const childId of anchor.children) {
      const childPose = projectRelativeToAnchor(
        childId,
        anchorPose,
        graph
      );
      poses.set(childId, childPose);
    }
  }

  return poses;
}

function projectRelativeToAnchor(
  nodeId: NodeId,
  anchorPose: XRPose,
  graph: SceneNode[]
): XRPose {
  const node = graph.find(n => n.id === nodeId);
  if (!node) return anchorPose;

  // Compute offset based on graph topology
  const siblingIndex = Array.from(node.parent?.children || []).indexOf(nodeId);
  const offset = {
    x: siblingIndex * 0.1, // 10cm apart
    y: 0,
    z: 0
  };

  // Transform anchor pose by offset
  return {
    transform: multiplyTransforms(anchorPose.transform, offset),
    emulatedPosition: false
  };
}
```

**Output Events** (derived):
```jsonl
{"operation":"project_ar_anchor","scope":{"authority":"derived"},"node_id":"node:desk","xr_anchor_pose":{"position":[0.5,0.8,- 1.2],"orientation":[0,0,0,1]},...}
{"operation":"project_ar_anchor","scope":{"authority":"derived"},"node_id":"node:model","xr_anchor_pose":{"position":[0.6,0.8,-1.2],"orientation":[0,0,0,1]},...}
```

---

## Projection Type 4: Map View (Tile-Based)

**Input**: Symbolic graph + tile IDs
**Output**: Geographic coordinates (lat/lon)
**Algorithm**: Tile → lat/lon conversion + spatial indexing

### Example: Tile Map Projector

**Input Events** (symbolic):
```jsonl
{"operation":"create_node","node_id":"node:poi","tile":"z3/x2/y5",...}
{"operation":"set_properties","node_id":"node:poi","properties":{"name":"Coffee Shop"},...}
```

**Projection Algorithm**:
```typescript
// projector-map-tiles.ts
export function projectTileToGeo(
  events: WorldEvent[]
): Map<NodeId, GeoCoordinate> {
  const coords = new Map<NodeId, GeoCoordinate>();

  for (const ev of events) {
    if (ev.operation === "create_node") {
      // Parse tile ID (symbolic) to lat/lon (numeric)
      const tile = parseTileId(ev.tile);
      const center = tileToLatLon(tile.z, tile.x, tile.y);

      // Add per-node offset based on graph topology
      const neighbors = getNeighbors(ev.node_id, events);
      const offset = computeLocalOffset(neighbors.length);

      coords.set(ev.node_id, {
        lat: center.lat + offset.lat,
        lon: center.lon + offset.lon,
        alt: 0
      });
    }
  }

  return coords;
}

function tileToLatLon(z: number, x: number, y: number): GeoCoordinate {
  const n = Math.pow(2, z);
  const lon = (x / n) * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180 / Math.PI);
  return { lat, lon, alt: 0 };
}

function computeLocalOffset(neighborCount: number): { lat: number; lon: number } {
  // Spread nodes within tile based on neighbor count
  const spread = 0.001; // ~100m at equator
  return {
    lat: (Math.random() - 0.5) * spread * neighborCount,
    lon: (Math.random() - 0.5) * spread * neighborCount
  };
}
```

**Output Events** (derived):
```jsonl
{"operation":"project_tile_map","scope":{"authority":"derived"},"node_id":"node:poi","geo":{"lat":37.7749,"lon":-122.4194,"alt":0},...}
```

---

## Projection Type 5: Physics Simulation (Deterministic)

**Input**: Symbolic graph + physics properties
**Output**: Numeric positions after simulation step
**Algorithm**: Verlet integration, constraint solving

### Example: Physics Stepper

**Input Events** (symbolic):
```jsonl
{"operation":"create_node","node_id":"node:ball","kind":"rigidbody",...}
{"operation":"set_physics","node_id":"node:ball","physics":{"mass":1.0,"restitution":0.8},...}
{"operation":"link_nodes","from_node":"node:ball","relation":"collides_with","to_node":"node:ground",...}
```

**Projection Algorithm**:
```typescript
// projector-physics-verlet.ts
export function stepPhysics(
  events: WorldEvent[],
  deltaTime: number,
  tick: number
): PhysicsStepEvent {
  const bodies = buildPhysicsBodies(events);

  // Verlet integration (deterministic)
  for (const body of bodies) {
    // Compute acceleration from forces
    const accel = computeForces(body, bodies);

    // Verlet step
    const newPos = {
      x: 2 * body.pos.x - body.oldPos.x + accel.x * deltaTime * deltaTime,
      y: 2 * body.pos.y - body.oldPos.y + accel.y * deltaTime * deltaTime,
      z: 2 * body.pos.z - body.oldPos.z + accel.z * deltaTime * deltaTime
    };

    body.oldPos = body.pos;
    body.pos = newPos;
  }

  // Solve constraints (collisions, joints)
  solveConstraints(bodies);

  // Emit derived event
  return {
    operation: "physics_step",
    scope: { authority: "derived", realm: "public", boundary: "interior" },
    solver: "verlet_v1",
    tick,
    delta_time: deltaTime,
    updates: bodies.map(b => ({
      node_id: b.id,
      transform: {
        position: [b.pos.x, b.pos.y, b.pos.z],
        rotation_quat: [0, 0, 0, 1],
        scale: [1, 1, 1]
      }
    })),
    // ... envelope fields
  };
}
```

**Output Events** (derived):
```jsonl
{"operation":"physics_step","scope":{"authority":"derived"},"solver":"verlet_v1","tick":42,"delta_time":16.67,"updates":[{"node_id":"node:ball","transform":{"position":[1.2,0.5,0],...}}],...}
```

---

## Common Patterns

### Pattern 1: Graph → Layout

```typescript
// Symbolic graph (source)
const graph = buildGraph(sourceEvents);

// Numeric layout (derived)
const layout = computeLayout(graph, algorithm);

// Emit derived events
for (const [nodeId, transform] of layout) {
  emitDerivedEvent({
    operation: `project_${algorithm}`,
    scope: { authority: "derived" },
    node_id: nodeId,
    transform
  });
}
```

### Pattern 2: Hierarchical Projection

```typescript
// Build parent-child tree (symbolic)
const tree = buildTree(sourceEvents);

// Project with hierarchical offsets (numeric)
function projectNode(node: TreeNode, parentTransform: Transform): Transform {
  const localOffset = computeOffset(node, node.siblings);
  return compose(parentTransform, localOffset);
}
```

### Pattern 3: Anchor-Based Projection

```typescript
// Find anchor nodes (symbolic)
const anchors = graph.filter(n => n.kind === "anchor");

// Resolve anchors to world space (numeric)
for (const anchor of anchors) {
  const worldPose = resolveAnchor(anchor);

  // Project children relative to anchor
  for (const child of anchor.children) {
    const childPose = projectRelative(child, worldPose, graph);
    emitDerivedEvent({ node_id: child.id, pose: childPose });
  }
}
```

---

## Determinism Requirements

All projectors must be **deterministic** to support replay:

1. **Seed from event graph**: Use node IDs, event IDs, or content hashes as random seeds
2. **No external state**: Don't depend on wall-clock time, network, or file system
3. **Fixed iteration counts**: Don't use convergence thresholds (use max iterations)
4. **Canonical ordering**: Process events in ULID order, not arrival order

### Example: Deterministic Random Placement

```typescript
// ❌ NON-DETERMINISTIC
function randomPlacement(node: Node): [number, number] {
  return [Math.random() * 1000, Math.random() * 1000];
}

// ✅ DETERMINISTIC
function randomPlacement(node: Node): [number, number] {
  const seed = hashString(node.id); // Seed from node ID
  const rng = new SeededRNG(seed);
  return [rng.next() * 1000, rng.next() * 1000];
}
```

---

## Testing Projectors

### Test 1: Idempotence

```typescript
test("projector is idempotent", () => {
  const events = loadEvents("trace.jsonl");

  const output1 = project(events);
  const output2 = project(events);

  expect(output1).toEqual(output2);
});
```

### Test 2: Determinism

```typescript
test("projector is deterministic", () => {
  const events = loadEvents("trace.jsonl");

  // Different process/thread
  const output1 = projectInWorker(events);
  const output2 = projectInWorker(events);

  expect(output1).toEqual(output2);
});
```

### Test 3: Boundary Compliance

```typescript
test("projector outputs only derived authority", () => {
  const events = loadEvents("trace.jsonl");
  const output = project(events);

  for (const ev of output) {
    expect(ev.scope.authority).toBe("derived");
  }
});
```

---

## Summary

| View Type | Input (Symbolic) | Algorithm | Output (Numeric) |
|-----------|------------------|-----------|------------------|
| 2D Canvas | Graph (nodes + edges) | Spring layout | 2D positions |
| 3D Scene | Hierarchy + geometry refs | Scene graph | 3D transforms |
| AR/VR | Anchors + relations | XR alignment | XR poses |
| Map | Tile IDs + properties | Tile → lat/lon | Geo coordinates |
| Physics | Bodies + constraints | Verlet integration | Simulated positions |

**All projectors**:
- Read symbolic events (source authority)
- Compute numeric projections (derived authority)
- Never write back to source
- Are deterministic and idempotent

---

## Next Steps

1. Implement reference projectors for each view type
2. Build projector test harness (idempotence, determinism, boundary)
3. Document projector composition (chaining multiple projectors)
4. Create projector WASM runtime (sandboxed, deterministic)
