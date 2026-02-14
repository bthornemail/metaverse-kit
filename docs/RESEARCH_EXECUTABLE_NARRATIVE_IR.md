# Executable Narrative IR

## Claim

Wave 16.1 implements narrative as deterministic IR:

story -> narrative state -> interaction tape -> template generator -> proposal artifact.

This is projection-only and advisory. Canonical authority remains outside narrative tooling.

## Scope

This document describes the current research surface, not future features.

Included:

- `wave16.narrative_state.v0`
- `wave16.interaction_tape.v0`
- `wave16.proposal_bundle.v0` (generator output)
- Solon path generator (`wave16.gen.solon.constitution.v0`)

Excluded:

- multiplayer consensus
- authoritative merge
- runtime simulation authority

## Core Invariants

1. Deterministic replay  
   Same inputs produce identical tape/proposal bytes.

2. Digest-bound lineage  
   Proposal binds base bundle digest, narrative digest, and interaction tape digest.

3. Non-authority discipline  
   Narrative artifacts are advisory and never mutate canonical state.

4. Fail-closed validation  
   Unknown verbs/targets or digest mismatch reject.

## Why This Matters

Most systems treat narrative as presentation metadata.  
Wave 16.1 treats narrative as a compile target with strict reproducibility.

This allows:

- auditable pedagogy
- replayable governance scenarios
- forkable interpretation without truth collapse

## Current Reference Path

Frozen canonical path:

1. `OPEN_PASSAGE` PRELUDE/02
2. `OPEN_PASSAGE` ARTICLE II
3. `SET_STANCE` solon
4. `SELECT_GENERATOR` `wave16.gen.solon.constitution.v0`
5. `GENERATE_PROPOSAL`

Reference artifacts:

- `dev-docs/narrative/solon-path.steps.json`
- `dev-docs/narrative/solon-path.tape.v0.json`
- `dev-docs/narrative/solon-constitution.proposal.v0.json`

## Research Questions

1. How stable are human-generated interaction tapes under external testing?
2. Which failure modes are cognitive (operator confusion) vs structural (schema mismatch)?
3. Can multiple narrative generators share one interaction grammar without semantic drift?

## Out-of-Scope Assertions

This document does not claim:

- moral truth from narrative output
- automated governance legitimacy
- semantic finality of any lens or generator

It claims only deterministic artifact production from frozen inputs.
