## Update Plan: Rendering the Articles as Living Projections

This plan assumes:

* The Articles already exist as authoritative story beats.
* You want them to become replayable across 1D, 2D, 3D (and now voxel).
* You do not change meaning—only how it appears.

---

### Phase 1 — Make Articles First-Class Beats

Goal: Turn each Article into a narrative unit that can be replayed.

Actions:

* Treat each Article as:

  * a sequence of beats
  * with sub-beats (paragraphs, scenes, voices)
* Assign each beat:

  * a semantic role (law, witness, gate, flood, covenant, etc.)
  * optional relationships to other beats
* Do not add visuals yet—just structure.

Outcome:

* Articles are now part of the open world diagram graph.
* They can be traversed, linked, and replayed in story-time.

---

### Phase 2 — Attach Projection Hints (Not Assets Yet)

Goal: Let Articles describe how they *could* appear.

Actions:

* For each beat, optionally add:

  * emphasis hints (foreground, background, chorus, aside)
  * motion hints (enter, linger, dissolve, repeat)
  * focus hints (speaker, object, boundary)
* No formats yet—just projection intent.

Outcome:

* Same Article can be staged differently by different variants.

---

### Phase 3 — Create Default Asset Sets

Goal: Make Articles visible without custom design.

Actions:

* Define a small “starter library” of default assets:

  * SVG symbols for roles (gate, witness, law, voice, flood, etc.)
  * GLB equivalents for 3D
  * simple sound cues for transitions
* Map semantic roles → default assets.

Outcome:

* Articles can instantly render in:

  * 1D (text + voice)
  * 2D (diagram + layout)
  * 3D (scene + camera)
    …without manual art for each beat.

---

### Phase 4 — Build Article Projectors

Goal: Let users switch how Articles are seen.

You need three core projectors:

1. Narrative projector (1D)

   * Shows text
   * Syncs voice or audio
   * Supports replay and scrubbing

2. Diagram projector (2D)

   * Uses SVG defaults
   * Lays out beats as shapes
   * Shows relationships as lines or regions

3. Scene projector (3D)

   * Uses GLB defaults
   * Places beats in space
   * Animates focus, transitions, camera

Outcome:

* Same Article, three ways to experience it.

---

### Phase 5 — Add Variant Packs

Goal: Let Articles be culturally or contextually re-skinned.

Actions:

* Create multiple variants:

  * academic
  * poetic
  * cinematic
  * minimal
* Each variant:

  * chooses different asset sets
  * changes pacing and emphasis
  * never changes story meaning

Outcome:

* Articles become adaptable to audience and purpose.

---

## Adding Voxels as a Bridge Between 2D and 3D

Yes—you should add a voxel type.

Not as “another 3D format,” but as a **structural bridge**.

---

### Why Voxels Matter

Voxels are:

* discrete like pixels
* spatial like 3D
* grid-based like diagrams

They sit between:

| Mode    | Nature                 |
| ------- | ---------------------- |
| 2D      | flat, symbolic, planar |
| Voxels  | volumetric, discrete   |
| 3D Mesh | continuous, smooth     |

So voxels are perfect for:

* block diagrams
* architectural metaphors
* construction of “worlds” from symbolic units
* Lego-like narrative building

---

### Voxel as a Projection Target

Add a new projection target:

* “Voxel volume”

A voxel asset can be:

* a simple grid file
* or derived from:

  * 2D SVG → extruded into blocks
  * 3D mesh → voxelized
  * semantic role → default voxel pattern

Voxels should be:

* easier to generate than meshes
* easier to manipulate than triangles
* visually expressive without heavy art

---

### Role in Your Story System

Voxels become:

* the “construction layer”
* the visible metaphor of:

  * building
  * law
  * city
  * flood
  * ark
  * tower
  * gate

For example:

* Babel = rising voxel tower
* Flood = voxel layers dissolving
* Covenant = stable voxel pattern
* Gate = threshold carved from blocks

---

### Where Voxels Fit in the Projection Ladder

Update your ladder:

```
0D – identity
1D – time, text, sound
2D – page, diagram, image
Voxel – volumetric diagram
3D – continuous scene
4D+ – simulation
```

Voxels are not “lesser 3D.”
They are “structured space.”

---

### Update Plan for Voxels

Phase A: Define voxel as a supported projection target
Phase B: Add default voxel patterns for semantic roles
Phase C: Allow beats to request voxel projection
Phase D: Add a voxel projector alongside 2D and 3D
Phase E: Let users switch: 2D → voxel → 3D

So they can literally see:

> diagram → structure → world

---

## Final Shape

With this plan, your Articles become:

* readable as text
* visible as diagrams
* inhabitable as scenes
* buildable as voxels
* replayable in time

And your system becomes:

> A narrative engine where meaning is stable,
> but appearance is endlessly reconfigurable.
