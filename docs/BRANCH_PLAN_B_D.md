# Branch Plan: Path B + Path D

Status: planning contract for multi-year protocol branches.

## Objectives

- Path B: social runtime (shared tapes, merge/conflict, consensus artifacts)
- Path D: avatar ontology (role permissions, dialogue grammar, embodied adapters)

Both branches remain projection-only until explicit authority integration is versioned.

## Shared Non-Goals

- no hidden authority elevation
- no mutable global truth state
- no wall-clock merge decisions
- no non-deterministic resolution paths

## Path B Milestones

### B.1 Shared Tape

- freeze `wave17.shared_tape.v0`
- freeze merge rules
- build validator + fixtures

### B.2 Conflict Bundles

- define conflict artifact
- deterministic diff surfaces
- side-by-side world comparisons

### B.3 Consensus Events

- signed acceptance/rejection artifacts
- quorum strategy docs
- replay checks

### B.4 Multiplayer Projection

- collaborative UI
- proposal-only outputs
- canonical isolation retained

## Path D Milestones

### D.1 Role Schema

- freeze `wave18.avatar_role.v0`
- role capability allowlists

### D.2 Dialogue Grammar

- freeze `wave18.dialogue_grammar.v0`
- legal transition automata

### D.3 Portal Role Binding

- stance UI bound to role artifacts
- grammar-checked interaction paths

### D.4 Agent Assist (advisory)

- optional AI role assistants
- proposal emission only

## Execution Policy

For each milestone:

1. ABI freeze doc
2. minimal tool implementation
3. golden fixtures
4. must-reject corpus
5. CI guard workflow

No milestone is “done” without all five.
