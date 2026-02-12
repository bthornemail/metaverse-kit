# Layer Contract Template

Use this template for any new package/app/tool before canonical-path integration.

If any section is left unspecified, the component is blocked from canonical integration.

## Component

- Name:
- Repository path:
- Owner:
- Status: draft | active | deprecated

## Layer Declaration

- Layer (choose one):
  - doctrine
  - hypervisor
  - substrate
  - app-vm
  - ir
  - projection
- Why this layer (one sentence):

## Authority Class

- Authority class: authoritative | advisory
- Authority boundary statement:
  - What this component is allowed to decide:
  - What this component must never decide:

## Inputs

List canonical inputs only.

- Input artifact 1:
  - ABI/version:
  - Required invariants:
- Input artifact 2:
  - ABI/version:
  - Required invariants:

## Outputs

List canonical outputs only.

- Output artifact 1:
  - ABI/version:
  - Deterministic encoding:
  - Authority class of output:
- Output artifact 2:
  - ABI/version:
  - Deterministic encoding:
  - Authority class of output:

## Forbidden Behavior

Explicitly list prohibited behavior.

- Must not mutate authoritative state outside declared output channel.
- Must not bypass validators/gates.
- Must not read hidden side channels as authority.
- Must not introduce non-determinism into authoritative outputs.
- Additional component-specific prohibitions:

## Replay Guarantee

- Replay class:
  - deterministic
  - deterministic-with-declared-seed
  - non-deterministic (advisory-only)
- Replay proof method:
- Golden coverage:
- Must-reject coverage:

## Failure Model

- Fail-closed conditions:
- Expected error prefixes/messages:
- Recovery path:

## Security / Integrity

- Content-addressing scheme:
- Signature/receipt requirements:
- Domain separation statement (if signing):
- Trust assumptions:

## Integration Gates

- Required spine step(s):
- Required test scripts:
- Required fixtures:
- Required goldens:

## Change Control

- Version bump rule:
- Backward compatibility rule:
- Deprecation path:

## Sign-off

- Author:
- Reviewer:
- Date (YYYY-MM-DD):
