/**
 * Complete Example: Symbolic → Projection → View
 *
 * This example demonstrates the complete flow:
 * 1. Create symbolic events (source authority, no coordinates)
 * 2. Project to numeric layout (derived authority)
 * 3. Validate boundary compliance
 * 4. Render view
 *
 * Run this example to see the symbolic/numeric boundary in action.
 */

import {
  WorldEvent,
  CreateNodeEvent,
  LinkNodesEvent,
  validateWorldEvent,
  validateBoundary,
} from "@metaverse-kit/protocol";
import { projectPipeline } from "./spring-layout-2d.js";
import { buildSymbolicGraph, computeStats } from "./graph-builder.js";

// ============================================================================
// Step 1: Create Symbolic Events (Source Authority)
// ============================================================================

function createSymbolicEvents(): WorldEvent[] {
  const events: WorldEvent[] = [];
  const now = Date.now();

  // Create nodes (no coordinates!)
  const nodes = [
    { id: "node:A", kind: "element" },
    { id: "node:B", kind: "element" },
    { id: "node:C", kind: "element" },
    { id: "node:D", kind: "element" },
    { id: "node:E", kind: "element" },
  ];

  for (const node of nodes) {
    const event: CreateNodeEvent = {
      event_id: `evt-create-${node.id}`,
      timestamp: now,
      space_id: "demo",
      layer_id: "layout",
      actor_id: "user:alice",
      operation: "create_node",
      scope: {
        authority: "source", // ✓ Source authority
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
      tile: "z0/x0/y0",

      node_id: node.id,
      kind: node.kind,

      // Identity transform (no numeric meaning)
      transform: {
        position: [0, 0, 0], // ✓ Not a coordinate - just identity
        rotation_quat: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
    };

    events.push(event);
  }

  // Create symbolic relations (edges in graph)
  const links = [
    { from: "node:A", to: "node:B", relation: "connected" },
    { from: "node:A", to: "node:C", relation: "connected" },
    { from: "node:B", to: "node:D", relation: "connected" },
    { from: "node:C", to: "node:D", relation: "connected" },
    { from: "node:D", to: "node:E", relation: "connected" },
  ];

  for (const link of links) {
    const event: LinkNodesEvent = {
      event_id: `evt-link-${link.from}-${link.to}`,
      timestamp: now,
      space_id: "demo",
      layer_id: "layout",
      actor_id: "user:alice",
      operation: "link_nodes",
      scope: {
        authority: "source", // ✓ Source authority
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
      tile: "z0/x0/y0",

      from_node: link.from,
      relation: link.relation,
      to_node: link.to,
    };

    events.push(event);
  }

  return events;
}

// ============================================================================
// Step 2: Validate Symbolic Events
// ============================================================================

function validateSymbolicEvents(events: WorldEvent[]): void {
  console.log("🔍 Validating symbolic events...\n");

  for (const event of events) {
    // Standard protocol validation
    try {
      validateWorldEvent(event);
      console.log(`✓ Event ${event.event_id} - protocol valid`);
    } catch (err) {
      console.error(`✗ Event ${event.event_id} - protocol invalid:`, err);
      throw err;
    }

    // Boundary validation (symbolic/numeric firewall)
    try {
      validateBoundary(event);
      console.log(`✓ Event ${event.event_id} - boundary compliant`);
    } catch (err) {
      console.error(`✗ Event ${event.event_id} - boundary violation:`, err);
      throw err;
    }
  }

  console.log(`\n✅ All ${events.length} events validated\n`);
}

// ============================================================================
// Step 3: Build Symbolic Graph
// ============================================================================

function analyzeSymbolicGraph(events: WorldEvent[]): void {
  console.log("📊 Building symbolic graph...\n");

  const graph = buildSymbolicGraph(events);
  const stats = computeStats(graph);

  console.log("Graph Statistics (Combinatorial Properties):");
  console.log(`  Nodes: ${stats.nodeCount}`);
  console.log(`  Edges: ${stats.edgeCount}`);
  console.log(`  Components: ${stats.components}`);
  console.log(`  Relations: ${Array.from(stats.relations).join(", ")}`);
  console.log(`  Kinds: ${Array.from(stats.kinds).join(", ")}`);
  console.log();

  // Show graph structure (symbolic)
  console.log("Graph Structure (Symbolic):");
  for (const [nodeId, node] of graph.nodes) {
    const neighbors = Array.from(node.outgoing.values())
      .flatMap(set => Array.from(set))
      .join(", ");
    console.log(`  ${nodeId} (${node.kind}) → [${neighbors}]`);
  }
  console.log();
}

// ============================================================================
// Step 4: Project to Numeric Layout
// ============================================================================

function projectToNumeric(events: WorldEvent[]): void {
  console.log("🎨 Projecting to numeric 2D layout...\n");

  const derivedEvents = projectPipeline(events, {
    space_id: "demo",
    tile_id: "z0/x0/y0",
    actor_id: "projector:spring_v1",
    solver: "spring_v1",
    layout: {
      iterations: 50,
      springLength: 100,
      springConstant: 0.1,
      repulsionConstant: 1000,
    },
  });

  console.log(`✓ Generated ${derivedEvents.length} derived events\n`);

  // Validate derived events
  console.log("🔍 Validating derived events...\n");
  for (const event of derivedEvents) {
    if (event.scope.authority !== "derived") {
      throw new Error(
        `Derived event has wrong authority: ${event.scope.authority}`
      );
    }
    console.log(
      `✓ ${event.for_node}: position [${event.transform.position[0].toFixed(1)}, ${event.transform.position[1].toFixed(1)}]`
    );
  }

  console.log(`\n✅ All derived events have authority: derived\n`);
}

// ============================================================================
// Step 5: Demonstrate Boundary Violation (for comparison)
// ============================================================================

function demonstrateBoundaryViolation(): void {
  console.log("❌ Demonstrating boundary violation...\n");

  // This is what you should NOT do
  const badEvent: CreateNodeEvent = {
    event_id: "evt-bad",
    timestamp: Date.now(),
    space_id: "demo",
    layer_id: "layout",
    actor_id: "user:alice",
    operation: "create_node",
    scope: {
      authority: "source", // ❌ Source authority with numeric coordinates
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
    tile: "z0/x0/y0",

    node_id: "node:bad",
    kind: "element",

    // ❌ VIOLATION: Numeric coordinates in source authority
    transform: {
      position: [100, 200, 0], // ❌ This is a measurement
      rotation_quat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
  };

  try {
    validateBoundary(badEvent);
    console.error("⚠️ Boundary validation did not catch violation!");
  } catch (err: any) {
    console.log("✓ Boundary violation detected:");
    console.log(`  ${err.message}\n`);
  }
}

// ============================================================================
// Step 6: Show Key Insights
// ============================================================================

function showInsights(): void {
  console.log("💡 Key Insights:\n");

  console.log("1. SYMBOLIC EVENTS (source authority):");
  console.log("   - Create nodes with identity transforms only");
  console.log("   - Link nodes with symbolic relations (adjacent, parent, etc.)");
  console.log("   - No numeric coordinates or measurements");
  console.log();

  console.log("2. NUMERIC PROJECTIONS (derived authority):");
  console.log("   - Read symbolic graph structure");
  console.log("   - Compute positions via algorithms (spring layout, etc.)");
  console.log("   - Emit derived events with transforms");
  console.log();

  console.log("3. THE FIREWALL:");
  console.log("   Symbolic (source) → Projection (derived) → View (ephemeral)");
  console.log("   One-way flow - numeric never becomes source authority");
  console.log();

  console.log("4. WHY THIS MATTERS:");
  console.log("   ✓ Deterministic replay (same graph → same projection)");
  console.log("   ✓ Multi-view support (2D, 3D, AR, VR from same events)");
  console.log("   ✓ Scale independence (graph works on ESP32, cloud)");
  console.log("   ✓ Offline-first (symbolic events are lightweight)");
  console.log();
}

// ============================================================================
// Main Execution
// ============================================================================

export function runCompleteExample(): void {
  console.log("═══════════════════════════════════════════════════════\n");
  console.log("  COMPLETE EXAMPLE: Symbolic → Projection → View\n");
  console.log("═══════════════════════════════════════════════════════\n\n");

  try {
    // Step 1: Create symbolic events
    const symbolicEvents = createSymbolicEvents();
    console.log(`📝 Created ${symbolicEvents.length} symbolic events\n`);

    // Step 2: Validate events
    validateSymbolicEvents(symbolicEvents);

    // Step 3: Analyze symbolic graph
    analyzeSymbolicGraph(symbolicEvents);

    // Step 4: Project to numeric layout
    projectToNumeric(symbolicEvents);

    // Step 5: Show what NOT to do
    demonstrateBoundaryViolation();

    // Step 6: Insights
    showInsights();

    console.log("═══════════════════════════════════════════════════════");
    console.log("✅ Example completed successfully!");
    console.log("═══════════════════════════════════════════════════════\n");
  } catch (err) {
    console.error("\n❌ Example failed:", err);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCompleteExample();
}
