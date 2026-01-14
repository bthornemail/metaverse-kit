# EXT32 Packs

Status: Draft

This document defines a minimal, practical schema for EXT32 packs. EXT32 packs
extend BASIS32 with federated, optional projection layers. They are proposals, not
authority.

## Goals

- Provide a stable namespace for shared feature sets.
- Allow multiple packs per node without altering identity.
- Keep packs optional and composable.
- Define how things look, sound, and are interacted with.

## Pack Schema (v0)

```json
{
  "pack_id": "ext32.narrative.v1",
  "namespace": "ext32.narrative",
  "version": "1.0.0",
  "description": "Narrative semantics for shared worlds",
  "features": [
    { "id": "tone", "type": "enum", "values": ["solemn", "urgent", "gentle"] },
    { "id": "role_bias", "type": "float", "range": [0, 1] },
    { "id": "relation_weight", "type": "float", "range": [0, 1] }
  ],
  "assets": {
    "default": {
      "svg": "symbol:witness",
      "glb": "gltf-sample:Fox@glb"
    },
    "roles": {
      "law": { "svg": "symbol:law", "glb": "gltf-sample:Box@glb" }
    }
  },
  "interactions": [
    {
      "name": "toggle-open",
      "trigger": "click",
      "conditions": ["state.closed == true"],
      "actions": [
        { "operation": "toggle_property", "path": "state.closed" },
        { "operation": "play_media", "ref": "media/open.wav" }
      ]
    }
  ],
  "projections": ["2d", "3d", "voxel"],
  "authority": "proposal"
}
```

## What EXT32 Is

Think of it like this:

EXT32 = "what this thing looks like, sounds like, and how you can touch it."

It is not "what it means philosophically." Meaning stays in the event stream and
PF16 identity; EXT32 is purely projection and interaction.

## Storage and Sync

- Packs are stored separately from local traces.
- Packs can be mirrored across worlds.
- Packs never mutate local authority.

## Rules

- A pack MAY propose features for any node.
- A pack MUST NOT alter PF16 or local event truth.
- A pack MUST be namespaced and versioned.

## Next Step

Implement a minimal pack registry with:

- `pack_id`, `namespace`, `version`, `features`
- a local index of installed packs
- a proposal channel for EXT32 features

Reference:

- `packages/ext32` (registry stub)
- `dev-docs/EXT32_PACK_SCHEMA.json`
