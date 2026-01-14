// Core type definitions for the Metaverse Kit event protocol
// This is the foundation of the entire system - all packages depend on these types

// ============================================================================
// Basic ID Types
// ============================================================================

export type EventId = string; // ULID or UUID
export type SpaceId = string; // Space identifier (e.g., "demo", "city_sim")
export type TileId = string; // Spatial tile ID (format: "z{z}/x{x}/y{y}")
export type LayerId = "layout" | "physics" | "presentation" | "meta";
export type ActorId = string; // Format: "user:alice" or "solver:phys_v1"
export type NodeId = string; // Format: "node:ulid"
export type HashRef = string; // Format: "sha256:<hex>" or "blake3:<hex>"
export type UrlRef = string; // URL or path reference
export type InlineText = string;

// ============================================================================
// Scope Types
// ============================================================================

export type Realm = "personal" | "team" | "public";
export type Authority = "source" | "derived";
export type Boundary = "interior" | "boundary" | "exterior";
export type Policy = "public" | "private" | "redacted";

export type Invariant =
  | "adjacency"
  | "exclusion"
  | "consistency"
  | "boundary_discipline"
  | "authority_nontransfer";

export interface Scope {
  realm: Realm;
  authority: Authority;
  boundary: Boundary;
  policy?: Policy;
}

// ============================================================================
// Transform Types
// ============================================================================

export interface Transform {
  position: [number, number, number]; // [x, y, z]
  rotation_quat: [number, number, number, number]; // [x, y, z, w]
  scale: [number, number, number]; // [sx, sy, sz]
}

// ============================================================================
// Link Types
// ============================================================================

export interface Link {
  relation: string; // e.g., "parent", "connected_to"
  to: NodeId;
}

// ============================================================================
// Event Envelope (base for all events)
// ============================================================================

export interface EventEnvelope {
  event_id: EventId;
  timestamp: number; // milliseconds since epoch
  space_id: SpaceId;
  layer_id: LayerId;
  actor_id: ActorId;
  operation: Operation;
  scope: Scope;
  preserves_invariants: Invariant[];
  previous_events: EventId[];
  tile: TileId;
}

// ============================================================================
// Operation Types
// ============================================================================

export type Operation =
  | "create_node"
  | "update_transform"
  | "set_properties"
  | "link_nodes"
  | "unlink_nodes"
  | "delete_node"
  | "merge"
  | "derived_feature32"
  | "proposal"        // SPABBS proposal channel
  | "accept_proposal" // SPABBS acceptance gate
  | "set_geometry"     // v1
  | "set_media"        // v1
  | "set_text"         // v1
  | "set_document"     // v1
  | "set_physics"      // v2
  | "physics_step"     // v2
  | `macro.${string}`; // macro namespace for deterministic expansions

// ============================================================================
// Operation-specific Event Types
// ============================================================================

export interface CreateNodeEvent extends EventEnvelope {
  operation: "create_node";
  node_id: NodeId;
  kind: string; // e.g., "primitive.rectangle", "primitive.line"
  transform: Transform;
  properties?: Record<string, unknown>;
}

export interface UpdateTransformEvent extends EventEnvelope {
  operation: "update_transform";
  node_id: NodeId;
  transform: Transform;
}

export interface SetPropertiesEvent extends EventEnvelope {
  operation: "set_properties";
  node_id: NodeId;
  properties: Record<string, unknown>;
}

export interface LinkNodesEvent extends EventEnvelope {
  operation: "link_nodes";
  from_node: NodeId;
  relation: string;
  to_node: NodeId;
}

export interface UnlinkNodesEvent extends EventEnvelope {
  operation: "unlink_nodes";
  from_node: NodeId;
  relation: string;
  to_node: NodeId;
}

export interface DeleteNodeEvent extends EventEnvelope {
  operation: "delete_node";
  node_id: NodeId;
}

export interface MergeEvent extends EventEnvelope {
  operation: "merge";
  previous_events: [EventId, EventId, ...EventId[]]; // 2+ parent events
}

// v1 operations
export interface SetGeometryEvent extends EventEnvelope {
  operation: "set_geometry";
  node_id: NodeId;
  geometry: {
    kind: "svg" | "obj" | "glb";
    ref: HashRef | UrlRef;
    units?: "m" | "cm" | "px";
  };
}

export interface SetMediaEvent extends EventEnvelope {
  operation: "set_media";
  node_id: NodeId;
  media: {
    kind: "svg" | "obj" | "mtl" | "glb" | "wav" | "mp4";
    ref: HashRef | UrlRef;
    mime?: string;
    meta?: {
      width?: number;
      height?: number;
      duration?: number;
      material_ref?: HashRef | UrlRef;
    };
  };
}

export interface SetTextEvent extends EventEnvelope {
  operation: "set_text";
  node_id: NodeId;
  text: {
    kind: "plain" | "markdown" | "code" | "json" | "yaml";
    ref: HashRef | UrlRef | InlineText;
    language?: string;
  };
}

export interface SetDocumentEvent extends EventEnvelope {
  operation: "set_document";
  node_id: NodeId;
  document: {
    kind: "pdf" | "md-page" | "canvas2d" | "html";
    ref: HashRef | UrlRef;
    pages?: number;
  };
}

// v2 operations
export interface SetPhysicsEvent extends EventEnvelope {
  operation: "set_physics";
  node_id: NodeId;
  physics: Record<string, unknown>;
}

export interface PhysicsStepEvent extends EventEnvelope {
  operation: "physics_step";
  solver: string; // e.g., "phys_v1"
  tick: number;
  delta_time: number;
  updates: Array<{ node_id: NodeId; transform: Transform }>;
}

// Derived features (BASIS32)
export interface DerivedFeature32Event extends EventEnvelope {
  operation: "derived_feature32";
  basis: string; // e.g., "BASIS32.v1"
  for: {
    tile: TileId;
    rid?: HashRef;
  };
  window?: {
    since_event?: EventId;
    until_event?: EventId;
  };
  features: number[]; // 32 buckets
  packed64?: string; // hex string, e.g. "0x..."
  packed128?: [string, string]; // two uint64 hex strings
}

// SPABBS proposal channel
export interface ProposalEvent extends EventEnvelope {
  operation: "proposal";
  proposal_id: string;
  layer: string; // e.g., "L2"
  target: { node_id?: NodeId; tile?: TileId };
  payload: Record<string, unknown>;
}

export interface AcceptProposalEvent extends EventEnvelope {
  operation: "accept_proposal";
  proposal_id: string;
  accepted_by: string; // e.g., "authority:gate"
  scope: "local" | "federated";
}

// ============================================================================
// Union of all event types (for discriminated unions)
// ============================================================================

export type WorldEvent =
  | CreateNodeEvent
  | UpdateTransformEvent
  | SetPropertiesEvent
  | LinkNodesEvent
  | UnlinkNodesEvent
  | DeleteNodeEvent
  | MergeEvent
  | SetGeometryEvent
  | SetMediaEvent
  | SetTextEvent
  | SetDocumentEvent
  | SetPhysicsEvent
  | PhysicsStepEvent
  | DerivedFeature32Event
  | ProposalEvent
  | AcceptProposalEvent
  | (EventEnvelope & Record<string, unknown>); // Forward-compatible for macros

// ============================================================================
// Tile Store Types
// ============================================================================

export interface SegmentRef {
  hash: HashRef;
  from_event?: EventId;
  to_event?: EventId;
}

export interface Manifest {
  tile_id: TileId;
  segments: SegmentRef[];
}

export interface Index {
  tile_id: TileId;
  tip_event: EventId;
  tip_segment: HashRef;
  last_snapshot?: HashRef;
  snapshot_event?: EventId;
  state256_root?: string;
  updated_at: number; // timestamp
}

export interface Snapshot {
  tile_id: TileId;
  at_event: EventId;
  state256_root?: string;
  nodes: Array<{
    node_id: NodeId;
    kind: string;
    transform: Transform;
    properties?: Record<string, unknown>;
    links?: Link[];
    geometry?: SetGeometryEvent["geometry"];
    media?: SetMediaEvent["media"];
    text?: SetTextEvent["text"];
    document?: SetDocumentEvent["document"];
    deleted?: boolean;
  }>;
}

// ============================================================================
// Sync Protocol Message Types (HTTP/WebSocket)
// ============================================================================

export interface GetTileTipRequest {
  type: "get_tile_tip";
  space_id: SpaceId;
  tile_id: TileId;
}

export interface GetTileTipResponse {
  tile_id: TileId;
  tip_event: EventId;
  tip_segment: HashRef;
  last_snapshot?: HashRef;
  snapshot_event?: EventId;
  state256_root?: string;
}

export interface GetSegmentsSinceRequest {
  type: "get_segments_since";
  space_id: SpaceId;
  tile_id: TileId;
  after_event: EventId | null;
}

export interface GetSegmentsSinceResponse {
  tile_id: TileId;
  segments: SegmentRef[];
}

export interface GetObjectRequest {
  type: "get_object";
  hash: HashRef;
}

export interface GetObjectResponse {
  hash: HashRef;
  bytes: Uint8Array | string; // binary or base64
}

export interface AppendEventsRequest {
  type: "append_events";
  space_id: SpaceId;
  tile_id: TileId;
  events: WorldEvent[];
}

export interface AppendEventsResponse {
  ok: boolean;
  appended: number;
  error?: string;
}

// ============================================================================
// Presence Types (ephemeral, not in ledger)
// ============================================================================

export interface PresenceUpdate {
  space_id: SpaceId;
  actor_id: ActorId;
  operation: "cursor_update" | "selection_update" | "viewport_update";
  position?: [number, number, number];
  selected_nodes?: NodeId[];
  viewport?: {
    center: [number, number];
    zoom: number;
    tiles: TileId[];
  };
}

// ============================================================================
// Helper type guards
// ============================================================================

export function isCreateNodeEvent(ev: WorldEvent): ev is CreateNodeEvent {
  return ev.operation === "create_node";
}

export function isUpdateTransformEvent(ev: WorldEvent): ev is UpdateTransformEvent {
  return ev.operation === "update_transform";
}

export function isSetPropertiesEvent(ev: WorldEvent): ev is SetPropertiesEvent {
  return ev.operation === "set_properties";
}

export function isLinkNodesEvent(ev: WorldEvent): ev is LinkNodesEvent {
  return ev.operation === "link_nodes";
}

export function isUnlinkNodesEvent(ev: WorldEvent): ev is UnlinkNodesEvent {
  return ev.operation === "unlink_nodes";
}

export function isDeleteNodeEvent(ev: WorldEvent): ev is DeleteNodeEvent {
  return ev.operation === "delete_node";
}

export function isMergeEvent(ev: WorldEvent): ev is MergeEvent {
  return ev.operation === "merge";
}

export function isSetGeometryEvent(ev: WorldEvent): ev is SetGeometryEvent {
  return ev.operation === "set_geometry";
}

export function isSetMediaEvent(ev: WorldEvent): ev is SetMediaEvent {
  return ev.operation === "set_media";
}

export function isSetPhysicsEvent(ev: WorldEvent): ev is SetPhysicsEvent {
  return ev.operation === "set_physics";
}

export function isPhysicsStepEvent(ev: WorldEvent): ev is PhysicsStepEvent {
  return ev.operation === "physics_step";
}
