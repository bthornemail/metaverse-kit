# Editor Ops v1

This document defines the minimal editor operations used by the UI. These map
directly to protocol events so the editor remains deterministic and replayable.

## Core Principles

- All edits emit protocol events.
- UI changes only meaning/state, never raw pixels.
- Projection is derived from role + pack + view mode.

## Operation Set

### 1) Create Node

Purpose: add a semantic node to the canvas.

Event: `create_node`

Fields:
- `node_id`
- `kind` (ex: `semantic.symbol`, `edge.relation`)
- `transform` (position/scale/rotation)
- `properties` (semantic role, labels, narrative metadata)

### 2) Update Geometry

Purpose: move/resize/rotate a node.

Event: `update_transform`

Fields:
- `node_id`
- `transform`

### 3) Update Properties

Purpose: edit semantics, labels, narrative fields, relation type, etc.

Event: `set_properties`

Fields:
- `node_id`
- `properties` (merge into existing)

### 4) Delete Node

Purpose: remove a node (tombstone).

Event: `delete_node`

Fields:
- `node_id`

### 5) Create Edge

Purpose: connect two nodes as a relation.

Event: `link_nodes`

Fields:
- `from_node`
- `to_node`
- `relation`

### 6) Delete Edge

Purpose: remove a relation.

Event: `unlink_nodes`

Fields:
- `from_node`
- `to_node`
- `relation`

### 7) Marker / Keyframe

Purpose: annotate time with meaning changes.

Event: `set_properties` on a marker node or local marker model.

Fields:
- `marker.type` (`cut` | `keyframe` | `beat` | `loop-in` | `loop-out`)
- `marker.payload` (roles/actions/intensity/visibility)

Note: markers are editor-owned metadata that can be migrated to events later.

## UI Mappings

- Palette drag/drop -> create_node.
- Move/resize/rotate -> update_transform.
- Inspector edits -> set_properties.
- Connectors -> link_nodes/unlink_nodes.
- Marker edits -> local marker model (export later).
