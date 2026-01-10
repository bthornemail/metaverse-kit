// NF.v1 Implementation: Event Normalization and Equivalence for Metaverse Kit
// Provides deterministic event ordering, state normalization, and equivalence checking

import { stableStringify, hashUtf8, type HashRef } from "@metaverse-kit/addr";
import type { WorldEvent, Invariant } from "@metaverse-kit/protocol";

// ============================================================================
// Root Invariants
// ============================================================================

export const ROOT_INVARIANTS: Invariant[] = [
  "adjacency",
  "exclusion",
  "consistency",
  "boundary_discipline",
  "authority_nontransfer",
];

// ============================================================================
// Event Normalization
// ============================================================================

/**
 * Normalize an event by ensuring all root invariants are present.
 * This is idempotent - calling it multiple times produces the same result.
 */
export function normalizeEvent<T extends WorldEvent>(ev: T): T {
  const normalized = { ...ev };

  // Ensure preserves_invariants includes all root invariants
  const invSet = new Set(normalized.preserves_invariants || []);
  for (const inv of ROOT_INVARIANTS) {
    invSet.add(inv);
  }

  // Sort invariants for deterministic ordering
  normalized.preserves_invariants = Array.from(invSet).sort() as Invariant[];

  return normalized;
}

/**
 * Normalize multiple events at once.
 */
export function normalizeEvents<T extends WorldEvent>(events: T[]): T[] {
  return events.map(ev => normalizeEvent(ev));
}

// ============================================================================
// Deterministic Event Ordering
// ============================================================================

/**
 * Sort events deterministically for application.
 *
 * Ordering rules:
 * 1. Primary: timestamp (ascending)
 * 2. Secondary: event_id (lexicographic)
 *
 * This ensures deterministic replay across all clients.
 */
export function orderEventsDeterministic<T extends WorldEvent>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    // First by timestamp
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }

    // Then by event_id (stable tiebreaker)
    return a.event_id.localeCompare(b.event_id);
  });
}

// ============================================================================
// No-op Pruning
// ============================================================================

/**
 * Remove obvious no-op events from a trace (MVP implementation).
 *
 * Currently removes:
 * - Duplicate consecutive transform updates (same node_id + identical transform)
 *
 * This is conservative - only removes clear no-ops that don't affect semantics.
 */
export function pruneNoOps<T extends WorldEvent>(events: T[]): T[] {
  const out: T[] = [];
  const lastTransformByNode = new Map<string, string>();

  for (const ev of events) {
    if (ev.operation === "update_transform") {
      const evt = ev as any;
      const key = evt.node_id as string;
      const norm = stableStringify(evt.transform);
      const prev = lastTransformByNode.get(key);

      if (prev === norm) {
        // Same transform as last update for this node - skip
        continue;
      }

      lastTransformByNode.set(key, norm);
    }

    out.push(ev);
  }

  return out;
}

// ============================================================================
// Trace Hashing
// ============================================================================

/**
 * Compute a normalized hash for a trace of events.
 *
 * Steps:
 * 1. Normalize all events (ensure invariants)
 * 2. Order deterministically
 * 3. Prune no-ops
 * 4. Hash canonical JSON
 *
 * Two traces with the same normalized hash are semantically equivalent.
 */
export function traceHash(events: WorldEvent[]): HashRef {
  const normalized = events.map(e => normalizeEvent(structuredClone(e)));
  const ordered = orderEventsDeterministic(normalized);
  const pruned = pruneNoOps(ordered);
  const canonical = stableStringify(pruned);
  return hashUtf8(canonical);
}

// ============================================================================
// State Normal Form
// ============================================================================

export interface NFLink {
  relation: string;
  to: string;
}

export interface NFNode {
  node_id: string;
  kind: string;
  transform: unknown;
  properties: Record<string, unknown>;
  links: NFLink[];
  deleted?: boolean;
}

export interface NFTileState {
  tile_id: string;
  nodes: NFNode[];
}

/**
 * Normalize a materialized tile state to canonical form.
 *
 * Rules:
 * - Nodes sorted by node_id
 * - Links sorted by (relation, to)
 * - Properties preserved as-is (assumed already in LWW form)
 * - Deleted flag normalized (true or undefined, never false)
 */
export function normalizeState(state: NFTileState): NFTileState {
  const nodes = state.nodes.map((n) => {
    // Sort links deterministically
    const links = [...(n.links || [])].sort((a, b) => {
      if (a.relation !== b.relation) {
        return a.relation.localeCompare(b.relation);
      }
      return a.to.localeCompare(b.to);
    });

    return {
      node_id: n.node_id,
      kind: n.kind,
      transform: n.transform,
      properties: n.properties || {},
      links,
      deleted: n.deleted ? true : undefined,
    } satisfies NFNode;
  });

  // Sort nodes by node_id
  nodes.sort((a, b) => a.node_id.localeCompare(b.node_id));

  return { tile_id: state.tile_id, nodes };
}

/**
 * Compute hash of a normalized state.
 */
export function stateHash(state: NFTileState): HashRef {
  const nf = normalizeState(state);
  const canonical = stableStringify(nf);
  return hashUtf8(canonical);
}

/**
 * Check if two states are equivalent (same normalized hash).
 */
export function equivalentStates(a: NFTileState, b: NFTileState): boolean {
  return stateHash(a) === stateHash(b);
}

// ============================================================================
// Trace Equivalence
// ============================================================================

/**
 * Check if two traces of events are equivalent.
 * Two traces are equivalent if they have the same normalized hash.
 */
export function equivalentTraces(a: WorldEvent[], b: WorldEvent[]): boolean {
  return traceHash(a) === traceHash(b);
}

// ============================================================================
// Utility: Extract Subsets
// ============================================================================

/**
 * Extract events for a specific tile from a mixed trace.
 */
export function filterByTile(events: WorldEvent[], tileId: string): WorldEvent[] {
  return events.filter(ev => ev.tile === tileId);
}

/**
 * Extract events for a specific layer from a trace.
 */
export function filterByLayer(events: WorldEvent[], layerId: string): WorldEvent[] {
  return events.filter(ev => ev.layer_id === layerId);
}

/**
 * Extract events by actor.
 */
export function filterByActor(events: WorldEvent[], actorId: string): WorldEvent[] {
  return events.filter(ev => ev.actor_id === actorId);
}

/**
 * Extract events in a time range (inclusive).
 */
export function filterByTimeRange(
  events: WorldEvent[],
  startTimestamp: number,
  endTimestamp: number
): WorldEvent[] {
  return events.filter(ev => ev.timestamp >= startTimestamp && ev.timestamp <= endTimestamp);
}
