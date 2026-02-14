# WAVE17 Shared Tape ABI

Status: branch freeze (design contract only).

## Purpose

`wave17.shared_tape.v0` defines a deterministic, append-only collaboration surface for multiple authors.

This artifact is advisory at this stage and must not mutate canonical world truth directly.

## Canonical Rules

- UTF-8 JSON
- sorted keys
- compact separators
- trailing newline
- strict keysets
- string membrane for leaf scalars
- digests: `sha256:<64hex>`

## Top-level keyset (exact)

- `v`
- `authority`
- `base_bundle_digest`
- `participants`
- `branches`
- `events`
- `merge_log`
- `summary`
- `digest`

Rules:

- `v` MUST be `wave17.shared_tape.v0`
- `authority` MUST be `advisory`
- `digest` MUST be sha256 of canonical JSON without `digest`

## Participants

`participants[]` keyset (exact):

- `author_id`
- `role`
- `pubkey_digest`

## Branches

`branches[]` keyset (exact):

- `branch_id`
- `parent_digest`
- `head_digest`
- `created_by`

## Events

`events[]` keyset (exact):

- `event_digest`
- `author_id`
- `branch_id`
- `t`

`event_digest` references existing `wave16.interaction_tape.v0` event digests.

## Merge Log

`merge_log[]` keyset (exact):

- `merge_id`
- `left_head`
- `right_head`
- `strategy`
- `result_head`
- `proposed_by`
- `status`

Allowed `strategy` enum:

- `linear_append`
- `fork_reconcile`
- `arbitration_proposal`
- `majority_vote`
- `constitutional_override`

Allowed `status` enum:

- `proposed`
- `accepted`
- `rejected`

## Reject Rules (minimum)

Reject on:

- unknown or missing keys
- non-contiguous event `t` per branch
- unresolved `author_id`/`branch_id`
- invalid merge strategy/status
- broken branch parent/head linkage
- digest mismatch
