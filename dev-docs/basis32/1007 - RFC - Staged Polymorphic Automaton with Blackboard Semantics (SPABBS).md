# RFC: Staged Polymorphic Automaton with Blackboard Semantics (SPABBS)

**Status:** Draft  
**Intended Status:** Experimental / Foundational  
**Author:** —  
**Related:** NF.v1, ADDR.v1, PF16.v1

---

## 1. Abstract

This document specifies a **Staged Polymorphic Automaton with Blackboard Semantics (SPABBS)**: a stratified reflective system in which each layer hosts a System-F–like typed core, communicates through one-directional blackboards, and permits reflection only across fixed boundaries. The design approximates System-U expressivity while avoiding logical collapse (e.g., Girard’s paradox) by enforcing a single absolute safety law:

> **No layer may generate or modify the rules that give it authority.**

---

## 2. Goals

The system MUST:

1. Support parametric polymorphism (System F–like) within each layer.
    
2. Support deterministic term rewriting and normalization within each layer.
    
3. Allow reflection and self-description across layers without self-authorization.
    
4. Preserve traceability and replay through blackboard communication.
    
5. Prevent paradox by forbidding self-modifying authority.
    

---

## 3. Non-Goals

The system does NOT:

- Implement dependent types or full System U.
    
- Permit arbitrary self-modification of typing or rewrite rules.
    
- Conflate projection, interpretation, and authority in a single layer.
    

---

## 4. Architecture

### 4.1 Layers

The system is composed of ordered layers:

```
L0 → L1 → L2 → … → Ln
```

Each layer:

- Has its own internal language (System F–like).
    
- Has a local rewrite and normalization discipline.
    
- Reads from an **input blackboard** and writes to an **output blackboard**.
    

### 4.2 Blackboard Semantics

- A blackboard is an append-only, deterministic trace of facts, terms, or proposals.
    
- Communication is one-directional:
    
    - Layer Li MAY read from Bi (its input).
        
    - Layer Li MAY write to Bi+1 (its output).
        
    - Layer Li MUST NOT mutate Bi or any upstream blackboard.
        

---

## 5. Internal Layer Model

### 5.1 Typed Core

Each layer MUST implement:

- A simply typed lambda calculus extended with:
    
    - universal quantification over types (System F)
        
    - parametric polymorphism
        
- Well-typedness MUST be enforced locally.
    

### 5.2 Rewriting

- Each layer MAY define rewrite rules over its internal terms.
    
- Rewrite rules MUST be terminating or stratified to guarantee normalization.
    
- Rewrite rules are authoritative only within that layer.
    

---

## 6. Reflection

Reflection is allowed only as:

- Observation of upstream layers.
    
- Generation of _proposals_ for downstream layers.
    

Reflection MUST NOT:

- Modify the type system of the same layer.
    
- Modify the rewrite rules of the same layer.
    
- Modify the authority rules of the same layer.
    

---

## 7. Absolute Safety Law

**Normative Rule:**

> A layer MUST NOT generate, modify, or activate the rules that give it authority.

Interpretation:

- A layer MAY:
    
    - rewrite terms
        
    - analyze itself
        
    - describe its own rules as data
        
    - propose new rules downstream
        
- A layer MUST NOT:
    
    - change its own typing rules
        
    - change its own rewrite rules
        
    - change the conditions under which its outputs become authoritative
        

Authority is conferred only by:

- upstream constraints, or
    
- a sealed higher-authority layer.
    

This law is REQUIRED to prevent logical collapse.

---

## 8. Proposal Mechanism

- A layer MAY emit _rule proposals_ to its output blackboard.
    
- Proposals are inert until accepted by a higher-authority layer.
    
- Acceptance MUST be explicit and trace-recorded.
    
- A layer MUST NOT accept its own proposals.
    

---

## 9. Typed Coordinate Projection (Derived View)

The following tuple is a **projection**, not a foundation:

```
(x, y, z | w, a, b, c, d)
```

Where:

- (x,y,z) = spatial / projection coordinates
    
- w = layer / stage index
    
- (a,b,c) = typed invariant parameters (constraints, interaction, state)
    
- d = derived coherence/tension value
    

This tuple is:

- derived from layered semantics
    
- NOT the source of authority
    
- a view for projection, analysis, and navigation
    

---

## 10. Interaction with Existing Specs

### 10.1 NF.v1 (Normal Form)

- Each layer’s rewrite system defines its own NF.
    
- NF equivalence is local to the layer.
    

### 10.2 ADDR.v1 (Addressing)

- Addresses MAY include layer index (w).
    
- Addresses MUST NOT imply authority; only trace + acceptance does.
    

### 10.3 PF16.v1 (Identity Composition)

- PF16 rules MAY operate inside a layer’s typed core.
    
- Composition results MUST respect layer boundaries.
    

---

## 11. Minimal Implementation Path

1. Explicitly define layers and their authority scopes.
    
2. Implement blackboard input/output per layer.
    
3. Enforce one-directional flow.
    
4. Add a typed core (System F-like) in at least one layer.
    
5. Enforce the Absolute Safety Law.
    
6. Add proposal and acceptance tracing.
    
7. Publish layer boundary map and pack registry.

---

## 14. Implementation Commitments (v0)

- L0 is authoritative and MUST NOT accept proposals without explicit acceptance.
- L1 (BASIS32) MUST be deterministic and replayable.
- L2 (EXT32) MUST be optional and never required for local operation.
- L3 (Projection) MUST treat L2 as hints, not truth.

See:

- `dev-docs/LAYER_BOUNDARIES.md`
- `dev-docs/PROPOSALS.md`
- `dev-docs/EXT32_PACKS.md`

---

## 12. Rationale

This system:

- Allows strong abstraction (System F).
    
- Allows reflection without paradox.
    
- Preserves trace, replay, and audit.
    
- Approaches System-U expressivity structurally, without self-typing collapse.
    

---

## 13. Summary

SPABBS is:

- A layered reflective automaton.
    
- With polymorphic typed cores.
    
- Communicating via blackboards.
    
- Governed by one law:
    

> No layer may generate or modify the rules that give it authority.

This law is the firewall between:

- powerful self-description  
    and
    
- logical collapse.
