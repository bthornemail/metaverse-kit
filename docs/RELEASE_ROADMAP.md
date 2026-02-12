# Metaverse Kit Release Roadmap

This roadmap prioritizes protocol stability, deterministic replay,
and authority discipline over feature velocity.

The goal is not rapid expansion.
The goal is a stable artifact ecosystem that others can trust.

---

## Philosophy

Metaverse Kit releases follow infrastructure rules:

- deterministic artifacts over features
- explicit authority boundaries
- frozen semantics per version
- projection never becomes truth
- reproducibility before performance

Every release must answer:

> Does this make worlds more verifiable?

Not:

> Does this add spectacle?

---

## Versioning model

- MAJOR: protocol or authority model change
- MINOR: additive features, backward compatible
- PATCH: bugfix, no semantic drift

Example:

v0.1.0 -> v0.1.1 -> v0.1.2
v0.2.0 (new capability layer)
v1.0.0 (protocol stability milestone)

---

## Phase 1 - v0.1.x Stabilization

**Status:** active

Focus: harden the deterministic demo slice

### Goals

- eliminate packaging edge cases
- tighten reproducibility CI
- expand must-reject corpora
- strengthen integrity verification
- document authority doctrine clearly

### Deliverables

- deterministic release reproducibility CI gate
- expanded corruption test corpus
- portal fail-closed audit
- improved release runbook docs
- contributor onboarding clarity

### Non-goals

- new runtime semantics
- new authority paths
- portal editing features
- multiplayer state sync

v0.1.x is about trust, not expansion.

---

## Phase 2 - v0.2 Proposal Workflow

Focus: safe authoring without authority collapse

### Goals

- formal proposal artifact lifecycle
- proposal review workflow
- deterministic diff surfaces
- fork/replay UX
- audit trail for changes

### Deliverables

- proposal bundle viewer
- proposal merge simulator
- review + approval CLI
- proposal reproducibility tests
- branch comparison tooling

### Constraints

- canonical logs remain append-only
- proposals never mutate truth directly
- merges remain explicit and inspectable

This phase enables collaboration
without breaking the authority model.

---

## Phase 3 - v0.3 Federation Layer

Focus: cross-world artifact exchange

### Goals

- portable world bundle federation
- receipt verification workflows
- trust boundaries between peers
- artifact signature policies
- content-addressed world linking

### Deliverables

- federation receipt format
- peer verification CLI
- bundle trust policies
- federation replay harness
- audit logs for import/export

This phase makes worlds shareable
without central authority.

---

## Phase 4 - v0.4 Runtime Scaling

Focus: performance and large traces

### Goals

- snapshot/compaction policy
- long-trace replay optimization
- streaming verification
- memory-bound portal playback
- large bundle packaging

### Deliverables

- snapshot format spec
- compaction tooling
- replay profiler
- performance regression CI
- streaming verifier

No semantic change.
Pure scalability engineering.

---

## Phase 5 - v1.0 Protocol Stability

Focus: freeze core semantics

### Criteria for v1.0

- stable proposal lifecycle
- stable federation model
- proven reproducibility guarantees
- hardened verification tooling
- documented governance model
- long-term artifact compatibility

v1.0 means:

> worlds created today replay in 10 years

That is the milestone.

---

## Long-term directions (post v1)

- XR adapters (projection-only)
- physics projections
- collaborative editing surfaces
- simulation runtimes
- distributed world hosting
- research interfaces

These remain projections.

Truth stays deterministic.

---

## Release discipline rules

- no silent protocol changes
- every semantic change bumps version
- frozen docs must match behavior
- artifacts must remain verifiable
- portal remains non-authoritative

If a change threatens these rules:

it does not ship.

---

## Roadmap summary

v0.1.x - stability
v0.2 - proposals
v0.3 - federation
v0.4 - scaling
v1.0 - protocol freeze

Everything else is projection.

The protocol is the product.
