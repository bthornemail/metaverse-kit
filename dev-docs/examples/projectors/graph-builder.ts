/**
 * Graph Builder - Extract Symbolic Graph from Events
 *
 * This utility demonstrates how to build a pure symbolic graph structure
 * from World Events, without any numeric interpretation.
 *
 * The graph contains only:
 * - Nodes (IDs and kinds)
 * - Edges (relations between nodes)
 * - Properties (symbolic key-value pairs)
 *
 * No coordinates, transforms, or numeric data.
 */

import {
  WorldEvent,
  NodeId,
  isCreateNodeEvent,
  isLinkNodesEvent,
  isUnlinkNodesEvent,
  isSetPropertiesEvent,
  isDeleteNodeEvent,
} from "@metaverse-kit/protocol";

// ============================================================================
// Symbolic Graph Types
// ============================================================================

export interface GraphNode {
  id: NodeId;
  kind: string;
  properties: Map<string, unknown>;
  outgoing: Map<string, Set<NodeId>>; // relation -> target nodes
  incoming: Map<string, Set<NodeId>>; // relation -> source nodes
  deleted: boolean;
}

export interface SymbolicGraph {
  nodes: Map<NodeId, GraphNode>;
  edges: Set<string>; // Stringified edge IDs for fast lookup
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Builds a symbolic graph from a sequence of events.
 * This is a pure symbolic operation - no numeric interpretation.
 *
 * @param events - Ordered list of World Events (source authority only recommended)
 * @returns Symbolic graph structure
 */
export function buildSymbolicGraph(events: WorldEvent[]): SymbolicGraph {
  const graph: SymbolicGraph = {
    nodes: new Map(),
    edges: new Set(),
  };

  for (const event of events) {
    applyEvent(graph, event);
  }

  return graph;
}

/**
 * Apply a single event to the graph (mutates graph in place)
 */
function applyEvent(graph: SymbolicGraph, event: WorldEvent): void {
  if (isCreateNodeEvent(event)) {
    // Create node (ignore numeric transform - it's not symbolic)
    graph.nodes.set(event.node_id, {
      id: event.node_id,
      kind: event.kind,
      properties: new Map(Object.entries(event.properties || {})),
      outgoing: new Map(),
      incoming: new Map(),
      deleted: false,
    });
  } else if (isLinkNodesEvent(event)) {
    // Add edge (symbolic relation)
    const from = ensureNode(graph, event.from_node);
    const to = ensureNode(graph, event.to_node);

    // Add to outgoing
    if (!from.outgoing.has(event.relation)) {
      from.outgoing.set(event.relation, new Set());
    }
    from.outgoing.get(event.relation)!.add(event.to_node);

    // Add to incoming
    if (!to.incoming.has(event.relation)) {
      to.incoming.set(event.relation, new Set());
    }
    to.incoming.get(event.relation)!.add(event.from_node);

    // Track edge
    graph.edges.add(edgeId(event.from_node, event.relation, event.to_node));
  } else if (isUnlinkNodesEvent(event)) {
    // Remove edge
    const from = graph.nodes.get(event.from_node);
    const to = graph.nodes.get(event.to_node);

    if (from) {
      from.outgoing.get(event.relation)?.delete(event.to_node);
    }
    if (to) {
      to.incoming.get(event.relation)?.delete(event.from_node);
    }

    graph.edges.delete(edgeId(event.from_node, event.relation, event.to_node));
  } else if (isSetPropertiesEvent(event)) {
    // Update properties (symbolic key-value)
    const node = ensureNode(graph, event.node_id);
    for (const [key, value] of Object.entries(event.properties)) {
      node.properties.set(key, value);
    }
  } else if (isDeleteNodeEvent(event)) {
    // Mark as deleted (tombstone)
    const node = graph.nodes.get(event.node_id);
    if (node) {
      node.deleted = true;
    }
  }
}

function ensureNode(graph: SymbolicGraph, nodeId: NodeId): GraphNode {
  if (!graph.nodes.has(nodeId)) {
    // Create stub node if referenced before creation
    graph.nodes.set(nodeId, {
      id: nodeId,
      kind: "unknown",
      properties: new Map(),
      outgoing: new Map(),
      incoming: new Map(),
      deleted: false,
    });
  }
  return graph.nodes.get(nodeId)!;
}

function edgeId(from: NodeId, relation: string, to: NodeId): string {
  return `${from}:${relation}:${to}`;
}

// ============================================================================
// Graph Query Utilities
// ============================================================================

/**
 * Get all neighbors of a node via a specific relation
 */
export function getNeighbors(
  graph: SymbolicGraph,
  nodeId: NodeId,
  relation?: string
): NodeId[] {
  const node = graph.nodes.get(nodeId);
  if (!node) return [];

  if (relation) {
    return Array.from(node.outgoing.get(relation) || []);
  } else {
    // All neighbors across all relations
    const neighbors = new Set<NodeId>();
    for (const targets of node.outgoing.values()) {
      for (const target of targets) {
        neighbors.add(target);
      }
    }
    return Array.from(neighbors);
  }
}

/**
 * Get all nodes connected to this node (incoming + outgoing)
 */
export function getConnected(
  graph: SymbolicGraph,
  nodeId: NodeId
): NodeId[] {
  const node = graph.nodes.get(nodeId);
  if (!node) return [];

  const connected = new Set<NodeId>();

  // Outgoing
  for (const targets of node.outgoing.values()) {
    for (const target of targets) {
      connected.add(target);
    }
  }

  // Incoming
  for (const sources of node.incoming.values()) {
    for (const source of sources) {
      connected.add(source);
    }
  }

  return Array.from(connected);
}

/**
 * BFS to find shortest path (pure graph operation)
 */
export function findPath(
  graph: SymbolicGraph,
  from: NodeId,
  to: NodeId
): NodeId[] | null {
  if (!graph.nodes.has(from) || !graph.nodes.has(to)) {
    return null;
  }

  const queue: Array<{ node: NodeId; path: NodeId[] }> = [
    { node: from, path: [from] },
  ];
  const visited = new Set<NodeId>([from]);

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;

    if (node === to) {
      return path;
    }

    const neighbors = getConnected(graph, node);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ node: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return null; // No path found
}

/**
 * Compute graph distance (BFS hop count)
 * This is the ONLY notion of "distance" in the symbolic core
 */
export function graphDistance(
  graph: SymbolicGraph,
  from: NodeId,
  to: NodeId
): number | null {
  const path = findPath(graph, from, to);
  return path ? path.length - 1 : null;
}

/**
 * Get all nodes matching a filter
 */
export function queryNodes(
  graph: SymbolicGraph,
  filter: (node: GraphNode) => boolean
): GraphNode[] {
  return Array.from(graph.nodes.values()).filter(filter);
}

/**
 * Get connected component containing a node
 */
export function getComponent(
  graph: SymbolicGraph,
  nodeId: NodeId
): Set<NodeId> {
  if (!graph.nodes.has(nodeId)) {
    return new Set();
  }

  const component = new Set<NodeId>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (component.has(current)) continue;

    component.add(current);

    const neighbors = getConnected(graph, current);
    for (const neighbor of neighbors) {
      if (!component.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return component;
}

// ============================================================================
// Export Graph Statistics (Combinatorial Properties)
// ============================================================================

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  deletedCount: number;
  components: number;
  relations: Set<string>;
  kinds: Set<string>;
}

export function computeStats(graph: SymbolicGraph): GraphStats {
  const relations = new Set<string>();
  const kinds = new Set<string>();
  let deletedCount = 0;

  for (const node of graph.nodes.values()) {
    kinds.add(node.kind);
    if (node.deleted) deletedCount++;

    for (const relation of node.outgoing.keys()) {
      relations.add(relation);
    }
  }

  // Count connected components
  const visited = new Set<NodeId>();
  let componentCount = 0;

  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      const component = getComponent(graph, nodeId);
      for (const id of component) {
        visited.add(id);
      }
      componentCount++;
    }
  }

  return {
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.size,
    deletedCount,
    components: componentCount,
    relations,
    kinds,
  };
}
