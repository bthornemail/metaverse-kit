# External Tester Evaluation Plan (Wave 16.1)

## Purpose

Collect reproducible friction data from independent testers without changing protocol semantics.

Primary objective: verify that an external engineer can execute the full Wave 16.1 path from docs alone.

## Tester Profile

- Familiar with terminal workflows
- No maintainer privileges
- No private context from team chat

## Required Artifacts

- release directory (`dist/metaverse-kit-v0.1`)
- docs in repo
- optional signature key material for verification

## Test Protocol

1. Base external verification
   - `bash scripts/external-tester-smoke.sh --dist dist/metaverse-kit-v0.1`

2. Wave 16.1 invariant checks
   - `npm run -s wave16:golden`
   - `npm run -s wave16:must-reject`

3. Narrative generation flow
   - emit interaction tape
   - validate interaction tape
   - generate Solon proposal

## Metrics

Track per tester:

- completion status (`pass|fail`)
- elapsed time (minutes)
- first failure step
- failure class:
  - environment
  - docs ambiguity
  - schema mismatch
  - command mismatch
  - digest mismatch
- number of maintainer interventions

## Acceptance Criteria

Evaluation pass requires:

- >=2 independent testers complete full flow
- zero undocumented manual patching
- all failures produce deterministic `ERROR:` markers

## Reporting Format

Each tester report should include:

- system info (OS, node version)
- command transcript
- observed errors (exact output snippets)
- suggested doc clarifications

## Change Policy During Evaluation

Allowed:

- docs clarifications
- non-semantic script UX improvements

Not allowed:

- protocol keyset changes
- digest rule changes
- verb set expansion

If semantic change is needed, defer to next version line.
