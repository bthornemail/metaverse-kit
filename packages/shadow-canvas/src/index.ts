// Shadow Canvas Implementation: Deterministic State Materializer
// Applies events to build current tile state with LWW and OR-Set semantics

import type {
  WorldEvent,
  TileId,
  NodeId,
  EventId,
  Transform,
  Link,
  Snapshot,
  CreateNodeEvent,
  UpdateTransformEvent,
  SetPropertiesEvent,
  LinkNodesEvent,
  UnlinkNodesEvent,
  DeleteNodeEvent,
  PhysicsStepEvent,
  SetGeometryEvent,
  SetMediaEvent,
  SetTextEvent,
  SetDocumentEvent,
} from "@metaverse-kit/protocol";
import {
  buildState256Projection,
  type State256Projection,
  type State256ProjectionOptions,
} from "@metaverse-kit/state256";
export {
  shadowCanvasProjection,
  muxTileStateToState256,
  demuxTileStateFromState256,
} from "./state256-projection.js";

// ============================================================================
// State Types
// ============================================================================

export interface NodeState {
  node_id: NodeId;
  kind: string;
  transform: Transform;
  properties: Record<string, unknown>;
  links: Link[];
  geometry?: SetGeometryEvent["geometry"];
  media?: SetMediaEvent["media"];
  text?: SetTextEvent["text"];
  document?: SetDocumentEvent["document"];
  deleted?: boolean;
}

export interface TileState {
  tile_id: TileId;
  nodes: Map<NodeId, NodeState>;
}

// ============================================================================
// Event Ordering
// ============================================================================

/**
 * Sort events deterministically for application.
 * Rules:
 * 1. timestamp (ascending)
 * 2. event_id (lexicographic) for tiebreaking
 */
export function sortEventsDeterministic(events: WorldEvent[]): WorldEvent[] {
  return [...events].sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return a.event_id.localeCompare(b.event_id);
  });
}

// ============================================================================
// Snapshot Loading
// ============================================================================

/**
 * Create initial tile state from a snapshot.
 */
export function stateFromSnapshot(snapshot: Snapshot): TileState {
  const nodes = new Map<NodeId, NodeState>();

  for (const n of snapshot.nodes) {
    nodes.set(n.node_id, {
      node_id: n.node_id,
      kind: n.kind,
      transform: n.transform,
      properties: n.properties ?? {},
      links: n.links ?? [],
      deleted: n.deleted,
    });
  }

  return {
    tile_id: snapshot.tile_id,
    nodes,
  };
}

// ============================================================================
// Event Application (Core Logic)
// ============================================================================

/**
 * Apply a single event to tile state.
 * This modifies the state in place.
 */
export function applyEvent(state: TileState, ev: WorldEvent): void {
  switch (ev.operation) {
    case "create_node":
      applyCreateNode(state, ev as CreateNodeEvent);
      break;

    case "update_transform":
      applyUpdateTransform(state, ev as UpdateTransformEvent);
      break;

    case "set_properties":
      applySetProperties(state, ev as SetPropertiesEvent);
      break;

    case "link_nodes":
      applyLinkNodes(state, ev as LinkNodesEvent);
      break;

    case "unlink_nodes":
      applyUnlinkNodes(state, ev as UnlinkNodesEvent);
      break;

    case "delete_node":
      applyDeleteNode(state, ev as DeleteNodeEvent);
      break;

    case "set_geometry":
      applySetGeometry(state, ev as SetGeometryEvent);
      break;

    case "set_media":
      applySetMedia(state, ev as SetMediaEvent);
      break;

    case "set_text":
      applySetText(state, ev as SetTextEvent);
      break;

    case "set_document":
      applySetDocument(state, ev as SetDocumentEvent);
      break;

    case "physics_step":
      applyPhysicsStep(state, ev as PhysicsStepEvent);
      break;

    case "merge":
      // Merge events don't directly modify state - they just mark DAG structure
      break;

    default:
      // Forward-compatible: ignore unknown operations (macros, future ops)
      if (!ev.operation.startsWith("macro.")) {
        console.warn(`Unknown operation: ${ev.operation} - ignoring`);
      }
      break;
  }
}

// ============================================================================
// State256 Projection (Optional)
// ============================================================================

export function projectState256FromTileState(
  state: TileState,
  options?: State256ProjectionOptions
): State256Projection {
  return buildState256Projection(Array.from(state.nodes.values()), options);
}

// Operation-specific handlers

function applyCreateNode(state: TileState, ev: CreateNodeEvent): void {
  // If node already exists, this is a conflict - skip creation
  if (state.nodes.has(ev.node_id)) {
    console.warn(`create_node conflict: node ${ev.node_id} already exists - skipping`);
    return;
  }

  state.nodes.set(ev.node_id, {
    node_id: ev.node_id,
    kind: ev.kind,
    transform: ev.transform,
    properties: ev.properties ?? {},
    links: [],
  });
}

function applyUpdateTransform(state: TileState, ev: UpdateTransformEvent): void {
  const node = state.nodes.get(ev.node_id);
  if (!node || node.deleted) return;

  // LWW: always apply (ordering ensures latest wins)
  node.transform = ev.transform;
}

function applySetProperties(state: TileState, ev: SetPropertiesEvent): void {
  const node = state.nodes.get(ev.node_id);
  if (!node || node.deleted) return;

  // LWW per key: merge properties
  for (const [key, value] of Object.entries(ev.properties)) {
    node.properties[key] = value;
  }
}

function applyLinkNodes(state: TileState, ev: LinkNodesEvent): void {
  const fromNode = state.nodes.get(ev.from_node);
  if (!fromNode || fromNode.deleted) return;

  // OR-Set semantics: add link (allow duplicates, they'll be deduplicated in queries)
  fromNode.links.push({
    relation: ev.relation,
    to: ev.to_node,
  });
}

function applyUnlinkNodes(state: TileState, ev: UnlinkNodesEvent): void {
  const fromNode = state.nodes.get(ev.from_node);
  if (!fromNode || fromNode.deleted) return;

  // OR-Set semantics: remove all matching links
  fromNode.links = fromNode.links.filter(
    (link) => !(link.relation === ev.relation && link.to === ev.to_node)
  );
}

function applyDeleteNode(state: TileState, ev: DeleteNodeEvent): void {
  const node = state.nodes.get(ev.node_id);
  if (!node) return;

  // Tombstone: mark as deleted but keep in state for history
  node.deleted = true;
}

function applySetGeometry(state: TileState, ev: SetGeometryEvent): void {
  const node = state.nodes.get(ev.node_id);
  if (!node || node.deleted) return;
  node.geometry = ev.geometry;
}

function applySetMedia(state: TileState, ev: SetMediaEvent): void {
  const node = state.nodes.get(ev.node_id);
  if (!node || node.deleted) return;
  node.media = ev.media;
}

function applySetText(state: TileState, ev: SetTextEvent): void {
  const node = state.nodes.get(ev.node_id);
  if (!node || node.deleted) return;
  node.text = ev.text;
}

function applySetDocument(state: TileState, ev: SetDocumentEvent): void {
  const node = state.nodes.get(ev.node_id);
  if (!node || node.deleted) return;
  node.document = ev.document;
}

function applyPhysicsStep(state: TileState, ev: PhysicsStepEvent): void {
  // Physics steps apply derived transform updates
  for (const update of ev.updates) {
    const node = state.nodes.get(update.node_id);
    if (!node || node.deleted) continue;

    // Apply transform from physics engine (authoritative if authority=derived)
    node.transform = update.transform;
  }
}

// ============================================================================
// State Building
// ============================================================================

/**
 * Build tile state from a snapshot and subsequent events.
 *
 * Steps:
 * 1. Load snapshot (or start empty)
 * 2. Sort events deterministically
 * 3. Apply each event in order
 *
 * This is the core materializer function.
 */
export function buildState(
  tile_id: TileId,
  snapshot: Snapshot | null,
  events: WorldEvent[]
): TileState {
  // Start from snapshot or empty state
  const state = snapshot
    ? stateFromSnapshot(snapshot)
    : { tile_id, nodes: new Map() };

  // Apply events in deterministic order
  const ordered = sortEventsDeterministic(events);
  for (const ev of ordered) {
    applyEvent(state, ev);
  }

  return state;
}

// ============================================================================
// Snapshot Creation
// ============================================================================

/**
 * Create a snapshot from current tile state.
 */
export function makeSnapshot(state: TileState, atEvent: EventId): Snapshot {
  return {
    tile_id: state.tile_id,
    at_event: atEvent,
    nodes: Array.from(state.nodes.values()).map((n) => ({
      node_id: n.node_id,
      kind: n.kind,
      transform: n.transform,
      properties: n.properties,
      links: n.links,
      geometry: n.geometry,
      media: n.media,
      text: n.text,
      document: n.document,
      deleted: n.deleted,
    })),
  };
}

// ============================================================================
// State Queries
// ============================================================================

/**
 * Get all live (non-deleted) nodes from state.
 */
export function getLiveNodes(state: TileState): NodeState[] {
  return Array.from(state.nodes.values()).filter((n) => !n.deleted);
}

/**
 * Get a specific node by ID (returns undefined if not found or deleted).
 */
export function getNode(state: TileState, nodeId: NodeId): NodeState | undefined {
  const node = state.nodes.get(nodeId);
  if (!node || node.deleted) return undefined;
  return node;
}

/**
 * Check if a node exists and is not deleted.
 */
export function nodeExists(state: TileState, nodeId: NodeId): boolean {
  const node = state.nodes.get(nodeId);
  return node !== undefined && !node.deleted;
}

/**
 * Get all nodes linked from a specific node by relation.
 */
export function getLinkedNodes(
  state: TileState,
  fromNodeId: NodeId,
  relation: string
): NodeId[] {
  const fromNode = state.nodes.get(fromNodeId);
  if (!fromNode || fromNode.deleted) return [];

  return fromNode.links
    .filter((link) => link.relation === relation)
    .map((link) => link.to);
}

/**
 * Get all incoming links to a node.
 */
export function getIncomingLinks(
  state: TileState,
  toNodeId: NodeId
): Array<{ from: NodeId; relation: string }> {
  const incoming: Array<{ from: NodeId; relation: string }> = [];

  for (const [nodeId, node] of state.nodes) {
    if (node.deleted) continue;

    for (const link of node.links) {
      if (link.to === toNodeId) {
        incoming.push({ from: nodeId, relation: link.relation });
      }
    }
  }

  return incoming;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get statistics about a tile state.
 */
export function getStateStats(state: TileState): {
  totalNodes: number;
  liveNodes: number;
  deletedNodes: number;
  totalLinks: number;
} {
  let liveNodes = 0;
  let deletedNodes = 0;
  let totalLinks = 0;

  for (const node of state.nodes.values()) {
    if (node.deleted) {
      deletedNodes++;
    } else {
      liveNodes++;
      totalLinks += node.links.length;
    }
  }

  return {
    totalNodes: state.nodes.size,
    liveNodes,
    deletedNodes,
    totalLinks,
  };
}
