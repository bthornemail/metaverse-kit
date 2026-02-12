# RFC Process

Protocol/runtime changes must follow RFC workflow before merge.

## When RFC is required

RFC required for changes to:

- protocol artifacts/schemas
- authority boundaries
- replay semantics
- release compatibility guarantees
- federation/receipt semantics

RFC optional for:

- documentation-only clarifications
- non-semantic tooling refactors

## RFC lifecycle

1. Draft
2. Review
3. Accepted / Rejected / Superseded
4. Implemented
5. Archived

## RFC template (minimum)

Each RFC must include:

- problem statement
- scope and non-goals
- layer placement in runtime hierarchy
- compatibility impact
- migration plan
- deterministic/replay impact
- security/authority analysis
- acceptance criteria

## Review rules

- minimum review window: 7 days
- at least one reviewer checks authority boundary effects
- at least one reviewer checks compatibility/migration quality

## Merge gate for accepted RFCs

Implementation PR must include:

- link to accepted RFC
- updated docs/ABIs
- deterministic tests
- must-reject coverage (if schema touched)
- release notes entry

## Fast-track policy

Emergency fixes may bypass full RFC only if:

- issue is security-critical or release-blocking
- follow-up RFC/postmortem is filed within 7 days

## Decision recording

Final decision and rationale must be written in the RFC file.
No governance by chat-only decisions.
