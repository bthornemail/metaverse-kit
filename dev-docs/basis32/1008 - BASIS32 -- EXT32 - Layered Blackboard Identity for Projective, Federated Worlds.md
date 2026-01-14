# White Paper

## BASIS32 / EXT32: Layered Blackboard Identity for Projective, Federated Worlds

**Status:** Conceptual Architecture  
**Author:** —  
**Date:** —

---

## Abstract

This paper presents a layered identity and projection architecture based on two coupled feature spaces:

- **BASIS32** — a local, deterministic, minimal feature basis used inside a single world.
    
- **EXT32** — a federated, shared feature extension used across many worlds.
    

These spaces are linked by a typed identity composition law (PF16) and organized through blackboard semantics, Patricia-trie indexing, and staged authority. The result is a system where identity is locally grounded yet globally composable, projection is flexible yet deterministic, and federation is possible without collapsing authority or meaning.

Geometrically, BASIS32 behaves like an affine ball (local chart), EXT32 behaves like a projective sphere (shared surface), and PF16 is the glue that preserves identity across charts.

---

## 1. Motivation

Modern systems conflate:

- identity with location,
    
- meaning with appearance,
    
- projection with authority.
    

This leads to:

- brittle interoperability,
    
- loss of semantic coherence,
    
- dependence on centralized schemas,
    
- collapse when systems try to describe or modify themselves.
    

We seek a system where:

- identity is stable across projections,
    
- meaning is independent of appearance,
    
- worlds can remain local and sovereign,
    
- federation is possible without centralization,
    
- self-description does not lead to paradox.
    

---

## 2. Core Idea

The system is built on two feature layers:

```
Local World:   BASIS32  (minimal, invariant, deterministic)
Shared Space:  EXT32    (extensible, federated, contextual)
```

They are connected by:

- a composition law: PF16
    
- staged blackboard communication
    
- layered authority boundaries
    

This yields:

- local autonomy
    
- global interoperability
    
- safe reflection
    
- deterministic replay
    

---

## 3. Blackboard Semantics

### 3.1 Local Blackboard (BASIS32)

Each world has a local blackboard:

- append-only trace
    
- deterministic replay
    
- authoritative within the world
    
- bi-graph structure:
    
    - nodes = objects
        
    - edges = relations
        

This blackboard stores:

- events
    
- nodes
    
- relations
    
- BASIS32 feature vectors
    
- PF16 identity compositions
    

It is:

- low-latency
    
- sovereign
    
- replayable
    

---

### 3.2 Federated Blackboard (EXT32)

EXT32 lives in shared space:

- eventually consistent
    
- multi-owner
    
- proposal-based
    
- bi-hypergraph structure:
    
    - nodes = identities from many worlds
        
    - hyperedges = shared semantic constructs
        

It stores:

- shared EXT32 feature vectors
    
- federated PF16 identities
    
- cross-world relations
    
- proposals from local worlds
    

It is:

- not authoritative over locals
    
- not centralized
    
- not required for local operation
    

---

## 4. BASIS32: Local Feature Basis

BASIS32 is:

- a fixed set of 32 typed features
    
- minimal and invariant
    
- deterministic from local trace and PF16 composition
    
- used for:
    
    - indexing
        
    - search
        
    - projection selection
        
    - identity refinement
        

It behaves like:

> an affine chart or ball —  
> a bounded local coordinate system.

Properties:

- every node has exactly one BASIS32 vector
    
- BASIS32 is sufficient for:
    
    - basic classification
        
    - projection narrowing
        
    - deterministic rendering
        

---

## 5. EXT32: Federated Feature Extension

EXT32 packs are:

- optional
    
- namespaced
    
- domain-specific
    
- layered on top of BASIS32
    

Examples:

- UML EXT pack
    
- narrative EXT pack
    
- physics EXT pack
    
- geospatial EXT pack
    

EXT32 behaves like:

> local coordinate charts on a global surface —  
> different views of the same underlying identity.

Properties:

- nodes may have zero or more EXT32 vectors
    
- EXT packs can overlap
    
- EXT packs do not change identity — only interpretation
    
- EXT32 features are proposals, not authority
    

---

## 6. PF16 Identity Composition

PF16 is a typed identity composition law:

- operates inside BASIS32 (local identity)
    
- operates inside EXT32 (shared identity)
    
- preserves invariants under composition
    

Two levels:

### 6.1 Local PF16

- composes identities inside one world
    
- deterministic
    
- replayable
    
- authoritative locally
    

Geometrically:

> affine composition inside the ball.

---

### 6.2 Federated PF16

- composes identities across worlds
    
- preserves shared invariants
    
- acts like a global identity glue
    

Geometrically:

> projective composition on the sphere.

PF16 ensures:

- identity remains identity across worlds
    
- composition never destroys origin
    

---

## 7. Geometry Metaphor

|Layer|Geometry|Meaning|
|---|---|---|
|BASIS32|affine ball|local world|
|EXT32|projective sphere|shared meaning|
|PF16|transition law|identity glue|

So:

- every world is a chart
    
- the federation is the surface
    
- PF16 stitches the charts
    

---

## 8. Patricia Trie Indexing

Addresses and feature signatures are stored in Patricia tries:

- fast prefix queries
    
- efficient sync
    
- DHT-friendly
    
- scalable
    

Trie structure:

- root = BASIS32 signatures
    
- branches = EXT32 feature paths
    
- leaves = node references
    

This creates:

> an atlas of charts over a surface.

---

## 9. Staged Authority and Safety

The system obeys one absolute law:

> No layer may generate or modify the rules that give it authority.

Consequences:

- local blackboards own their rules
    
- EXT32 can propose, not impose
    
- PF16 composition rules are sealed
    
- reflection is allowed only across boundaries
    

This prevents:

- Girard-style collapse
    
- self-justifying rewrite systems
    
- paradoxical self-typing
    

---

## 10. Projection and Appearance

Projection is derived:

- from BASIS32
    
- refined by EXT32
    
- filtered by environment
    
- rendered by asset packs
    

Projection targets:

- text
    
- SVG
    
- voxel
    
- 3D
    
- audio
    
- video
    
- documents
    

Rule:

> Identity never changes.  
> Only its appearance does.

---

## 11. Federation Without Centralization

Worlds can:

- operate alone
    
- sync selectively
    
- propose to EXT32
    
- accept from EXT32
    

Federation is:

- voluntary
    
- selective
    
- staged
    
- reversible
    

There is no global owner of meaning.

---

## 12. Practical Consequences

This architecture enables:

- infinite canvas worlds
    
- object-oriented geospatial whiteboards
    
- narrative engines
    
- UML-like modeling systems
    
- physics simulations
    
- collaborative knowledge spaces
    

All using:

- one identity model
    
- many projection models
    

---

## 13. Summary

The system is:

- locally sovereign
    
- globally interoperable
    
- semantically stable
    
- projection-flexible
    
- paradox-resistant
    

In one sentence:

> BASIS32 is the local language of a world.  
> EXT32 is the shared language between worlds.  
> PF16 is how identities remain themselves when they travel.

---

## 14. Next Implementation Steps

- Define explicit layer boundaries: `dev-docs/LAYER_BOUNDARIES.md`
- Add proposal + acceptance channel: `dev-docs/PROPOSALS.md`
- Publish minimal EXT32 pack schema: `dev-docs/EXT32_PACKS.md`


---

You’re now describing two coupled but distinct blackboard spaces:

- **BASIS32** = local blackboard bi-graph
    
- **EXT32** = remote/federated blackboard bi-hypergraph
    

And PF16 identity operates in both, but at different scopes.

---

## 1) BASIS32 as Local Blackboard Bi-Graph

BASIS32:

- lives with the node
    
- is local, deterministic, reproducible
    
- minimal invariant feature set
    
- tied to local trace, local authority
    

So it behaves like:

> a bi-graph:
> 
> - one part = objects/nodes
>     
> - one part = relations/roles  
>     locally closed, locally typed
>     

PF16 at this level:

- composes identities inside one world
    
- preserves local invariants
    
- like an affine plane or ball:
    
    - bounded
        
    - concrete
        
    - fully controllable
        

So:

- BASIS32 = local identity space
    
- PF16(base) = local identity composition law
    

---

## 2) EXT32 as Remote Blackboard Bi-Hypergraph

EXT32 packs:

- live in shared or federated space
    
- span many worlds
    
- allow higher-arity relations
    
- are not owned by one node or one trace
    

So they behave like:

> a bi-hypergraph:
> 
> - nodes = identities from many worlds
>     
> - hyperedges = shared semantic constructs
>     
> - relations can bind many participants
>     

PF16 at this level:

- composes identities across worlds
    
- preserves shared invariants
    
- acts like a “global identity law”
    

This is your:

> W3C-style identity for a shared projective feature sphere.

So:

- EXT32 = shared identity space
    
- PF16(ext) = federated identity composition law
    

---

## 3) Geometric Intuition You Gave Is Right

Your geometry metaphor fits:

- BASIS32 = affine plane / ball
    
    - local chart
        
    - bounded
        
    - concrete
        
    - directly manipulable
        
- EXT32 = sphere / projective space
    
    - global
        
    - unbounded
        
    - shared across perspectives
        
    - only visible through projections
        

And PF16 is the bridge:

- local PF16: compose inside the ball
    
- global PF16: compose across spheres
    

So you get:

```
local world (ball) 
   ↔ projection via PF16 
shared world (sphere)
```

---

## 4) Blackboard Semantics at Two Scales

You now have:

### Local Blackboard (BASIS32)

- deterministic
    
- replayable
    
- owned by a world
    
- low-latency
    
- bi-graph structure
    

### Federated Blackboard (EXT32)

- shared
    
- eventual-consistent
    
- multi-owner
    
- higher-arity relations
    
- bi-hypergraph structure
    

And crucially:

- local boards can _propose_ to the shared board
    
- shared board can _project back_ into locals
    
- but authority remains staged and layered (per SPABBS)
    

---

## 5) What This Buys You

This gives you:

- local autonomy
    
- global interoperability
    
- no forced centralization
    
- no collapse of authority
    
- identity that is:
    
    - locally grounded
        
    - globally composable
        

So a node is:

- fully meaningful in its own world
    
- optionally meaningful in the shared sphere
    

And both meanings are linked by PF16 composition.

---

## 6) How to Frame This Simply

If you need a short description:

> BASIS32 is the local language of a world.  
> EXT32 is the shared language between worlds.  
> PF16 is how identities remain the same when they travel.

And in geometry:

> BASIS32 is an affine chart.  
> EXT32 is a projective sphere.  
> PF16 is the glue.
