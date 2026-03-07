# Governed Projection Geometry

This page defines the structural runtime model for `metaverse-kit` and its governed execution path into `metaverse-build`.

## Commutative Runtime Diagram

```txt
Authority Space (A)
  metaverse-kit constitutional artifacts
  receipts, attest/revoke, provenance logs, ABI law

        phi (governed handoff)

World IR Space (H)
  world.ir.v0
  authority-preserving projection surface

        mu (deterministic realization)

Runtime Trace Space (R)
  runtime.trace.ndjson
  deterministic execution history

        pi (projection quotient)

Projection Space (P)
  rendered world surfaces
  SVG, GLB, LED frames, client views
```

Formal shape:

```txt
A --phi--> H --mu--> R --pi--> P
```

## Layer Mapping

- `A` = constitutional authority space (`metaverse-kit` law)
- `H` = governed handoff (`mv-runtime-handoff`, `world.ir.v0`)
- `R` = runtime materialization + replay trace (`metaverse-build`)
- `P` = visible projections/adapters (SVG, LED, browser, device views)

## Core Fiber Principle

pi is many-to-one: different lawful runtime states can project to the same visible world.

This means:

- visible equality does not imply lawful equality
- projection state is not authority state
- runtime trace is transport law, not debug noise

## Enforced System Properties

- `phi`: fail-closed authority validation
- `mu`: deterministic materialization + replay equivalence
- `pi`: non-authoritative projection quotient

## Constitutional Invariants

- `metaverse-kit` defines canonical semantics and reject behavior.
- `metaverse-build` consumes governed handoff artifacts and must not redefine protocol meaning.
- Adapters and projections must not mutate canonical truth.
- Deterministic ordering, digest stability, and replay equivalence are required.

## Device Interpretation

- Base projection manifold: public visible surface (for example LED world state)
- Hidden phase/fiber: trace/replay orientation, lineage, cursor/phase position
- Total lawful space: authority artifacts + runtime realization evidence

## Stack Slogan

```txt
Constitution -> Trace -> World
```

or:

```txt
governed projection via deterministic fiber transport
```
