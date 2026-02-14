# WAVE17 Merge Rules

Status: branch freeze (deterministic merge semantics).

## Scope

These rules apply to `wave17.shared_tape.v0` merge proposals.

They define deterministic outcomes for candidate branch heads.

## General Invariants

1. Merge is artifact production, not in-place mutation.
2. Merge inputs and outputs are digest-bound.
3. Every merge decision is replayable from artifacts.
4. No hidden heuristics or wall-clock tie-breakers.

## Strategy Semantics

### `linear_append`

- Preconditions:
  - right branch extends left head without conflict.
- Result:
  - `result_head = right_head`.

### `fork_reconcile`

- Preconditions:
  - both heads diverge from common ancestor.
- Result:
  - emit a deterministic reconciliation proposal artifact.
  - `status` remains `proposed` until accepted.

### `arbitration_proposal`

- Preconditions:
  - conflict bundle exists.
- Result:
  - result determined by referenced arbitration artifact digest.

### `majority_vote`

- Preconditions:
  - vote artifact exists with valid participant set.
- Result:
  - winning head selected deterministically by vote tally.

### `constitutional_override`

- Preconditions:
  - explicit constitutional rule reference exists.
- Result:
  - result head selected per referenced rule artifact.

## Tie-break Rule (required)

If a strategy yields multiple valid result heads, select lexicographically smallest digest.

## Reject Conditions

Reject merge proposal if:

- any referenced head digest is unresolved
- strategy preconditions are unmet
- result head does not match deterministic rule outcome
- participant/vote set is invalid
- constitutional reference digest is missing
