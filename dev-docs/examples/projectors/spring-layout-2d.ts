/**
 * Spring Layout 2D Projector
 *
 * Demonstrates proper symbolic → numeric projection:
 * 1. Read symbolic graph (nodes + edges)
 * 2. Compute numeric 2D positions via force-directed layout
 * 3. Emit derived events with authority: derived
 *
 * This projector is:
 * - Deterministic (seeded from node IDs)
 * - Idempotent (same graph → same layout)
 * - Boundary-compliant (only derived authority output)
 */

import {
  WorldEvent,
  NodeId,
  EventId,
  SpaceId,
  TileId,
  ActorId,
} from "@metaverse-kit/protocol";
import { buildSymbolicGraph, SymbolicGraph, getConnected } from "./graph-builder.js";

// ============================================================================
// Projection Types (Numeric)
// ============================================================================

interface Vec2 {
  x: number;
  y: number;
}

interface LayoutNode {
  id: NodeId;
  pos: Vec2;
  vel: Vec2;
  neighbors: NodeId[];
}

export interface Layout2D {
  positions: Map<NodeId, Vec2>;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

// ============================================================================
// Projector Configuration
// ============================================================================

export interface SpringLayoutConfig {
  // Force parameters
  springConstant: number; // Attraction strength
  springLength: number; // Rest length
  repulsionConstant: number; // Coulomb repulsion strength
  damping: number; // Velocity damping (0-1)

  // Simulation
  iterations: number; // Fixed iteration count (deterministic)
  timeStep: number;

  // Initial layout
  seed?: number; // Random seed (defaults to hash of node IDs)
  initialRadius: number; // Initial random circle radius
}

const DEFAULT_CONFIG: SpringLayoutConfig = {
  springConstant: 0.1,
  springLength: 100,
  repulsionConstant: 1000,
  damping: 0.85,
  iterations: 100,
  initialRadius: 200,
};

// ============================================================================
// Deterministic Random Number Generator
// ============================================================================

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    // Xorshift32
    let x = this.state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    this.state = x >>> 0; // Ensure unsigned 32-bit
    return this.state / 0xffffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// ============================================================================
// Spring Layout Algorithm
// ============================================================================

/**
 * Project symbolic graph to 2D positions using spring layout
 * @param graph - Symbolic graph (no numeric data)
 * @param config - Layout parameters
 * @returns Numeric 2D positions for each node
 */
export function projectSpringLayout(
  graph: SymbolicGraph,
  config: Partial<SpringLayoutConfig> = {}
): Layout2D {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 1. Initialize layout nodes with deterministic random positions
  const layoutNodes = initializeLayout(graph, cfg);

  // 2. Run fixed number of iterations (deterministic)
  for (let i = 0; i < cfg.iterations; i++) {
    stepForces(layoutNodes, cfg);
  }

  // 3. Extract final positions
  const positions = new Map<NodeId, Vec2>();
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const node of layoutNodes) {
    positions.set(node.id, { ...node.pos });

    minX = Math.min(minX, node.pos.x);
    maxX = Math.max(maxX, node.pos.x);
    minY = Math.min(minY, node.pos.y);
    maxY = Math.max(maxY, node.pos.y);
  }

  return {
    positions,
    bounds: { minX, maxX, minY, maxY },
  };
}

function initializeLayout(
  graph: SymbolicGraph,
  config: SpringLayoutConfig
): LayoutNode[] {
  // Deterministic seed from all node IDs
  const seed = config.seed ?? hashString(
    Array.from(graph.nodes.keys()).sort().join(",")
  );
  const rng = new SeededRandom(seed);

  const layoutNodes: LayoutNode[] = [];

  for (const [nodeId, graphNode] of graph.nodes) {
    if (graphNode.deleted) continue;

    // Random position on circle
    const angle = rng.next() * 2 * Math.PI;
    const radius = rng.range(0, config.initialRadius);

    layoutNodes.push({
      id: nodeId,
      pos: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      },
      vel: { x: 0, y: 0 },
      neighbors: getConnected(graph, nodeId),
    });
  }

  return layoutNodes;
}

function stepForces(nodes: LayoutNode[], config: SpringLayoutConfig): void {
  const forces = new Map<NodeId, Vec2>();

  // Initialize forces
  for (const node of nodes) {
    forces.set(node.id, { x: 0, y: 0 });
  }

  // Spring attraction between connected nodes
  for (const node of nodes) {
    const force = forces.get(node.id)!;

    for (const neighborId of node.neighbors) {
      const neighbor = nodes.find(n => n.id === neighborId);
      if (!neighbor) continue;

      const dx = neighbor.pos.x - node.pos.x;
      const dy = neighbor.pos.y - node.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Hooke's law: F = k * (d - rest)
      const magnitude = config.springConstant * (dist - config.springLength);

      force.x += (dx / dist) * magnitude;
      force.y += (dy / dist) * magnitude;
    }
  }

  // Coulomb repulsion between all pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const distSq = dx * dx + dy * dy || 1;
      const dist = Math.sqrt(distSq);

      // Coulomb: F = k / d^2
      const magnitude = config.repulsionConstant / distSq;

      const forceA = forces.get(a.id)!;
      const forceB = forces.get(b.id)!;

      forceA.x -= (dx / dist) * magnitude;
      forceA.y -= (dy / dist) * magnitude;
      forceB.x += (dx / dist) * magnitude;
      forceB.y += (dy / dist) * magnitude;
    }
  }

  // Update velocities and positions
  for (const node of nodes) {
    const force = forces.get(node.id)!;

    // F = ma, a = F (assuming m=1)
    node.vel.x += force.x * config.timeStep;
    node.vel.y += force.y * config.timeStep;

    // Damping
    node.vel.x *= config.damping;
    node.vel.y *= config.damping;

    // Update position
    node.pos.x += node.vel.x * config.timeStep;
    node.pos.y += node.vel.y * config.timeStep;
  }
}

// ============================================================================
// Emit Derived Events (Boundary Compliant)
// ============================================================================

export interface DerivedLayoutEvent extends WorldEvent {
  operation: "project_layout_spring";
  scope: {
    authority: "derived";
    realm: "public";
    boundary: "interior";
  };
  solver: string;
  iteration: number;
  for_node: NodeId;
  transform: {
    position: [number, number, number];
    rotation_quat: [number, number, number, number];
    scale: [number, number, number];
  };
}

/**
 * Convert layout to derived events
 * These events have authority: derived and contain numeric transforms
 */
export function emitDerivedEvents(
  layout: Layout2D,
  sourceEvents: WorldEvent[],
  config: {
    space_id: SpaceId;
    tile_id: TileId;
    actor_id: ActorId;
    solver: string;
  }
): DerivedLayoutEvent[] {
  const events: DerivedLayoutEvent[] = [];

  let eventCounter = 0;
  const now = Date.now();

  for (const [nodeId, pos] of layout.positions) {
    events.push({
      // Event envelope
      event_id: `derived-layout-${eventCounter++}` as EventId,
      timestamp: now,
      space_id: config.space_id,
      layer_id: "layout",
      actor_id: config.actor_id,
      operation: "project_layout_spring",
      scope: {
        authority: "derived", // ✓ Derived authority
        realm: "public",
        boundary: "interior",
      },
      preserves_invariants: [
        "adjacency",
        "exclusion",
        "consistency",
        "boundary_discipline",
        "authority_nontransfer",
      ],
      previous_events: [],
      tile: config.tile_id,

      // Projection-specific fields
      solver: config.solver,
      iteration: eventCounter,
      for_node: nodeId,

      // Numeric transform (allowed in derived events)
      transform: {
        position: [pos.x, pos.y, 0],
        rotation_quat: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
    });
  }

  return events;
}

// ============================================================================
// Complete Projection Pipeline
// ============================================================================

/**
 * Full projection pipeline: symbolic events → numeric layout → derived events
 *
 * @param sourceEvents - Events with authority: source (symbolic)
 * @param config - Projector configuration
 * @returns Derived events with numeric transforms
 */
export function projectPipeline(
  sourceEvents: WorldEvent[],
  config: {
    space_id: SpaceId;
    tile_id: TileId;
    actor_id: ActorId;
    solver?: string;
    layout?: Partial<SpringLayoutConfig>;
  }
): DerivedLayoutEvent[] {
  // Step 1: Build symbolic graph (no numeric interpretation)
  const graph = buildSymbolicGraph(sourceEvents);

  // Step 2: Project to numeric layout
  const layout = projectSpringLayout(graph, config.layout);

  // Step 3: Emit derived events
  const derivedEvents = emitDerivedEvents(layout, sourceEvents, {
    space_id: config.space_id,
    tile_id: config.tile_id,
    actor_id: config.actor_id,
    solver: config.solver || "spring_v1",
  });

  return derivedEvents;
}
