# WAVE27 Pointer Sync ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: deterministic projection where two peers induce motion on a shared 240-pointer ring, producing replayable append-only trace artifacts and explicit residual artifacts on divergence.

## Scope

This ABI defines:

- public state and private inputs
- deterministic step transition contract
- commit/fail-fast rules
- append-only NDJSON trace schema
- residual artifact schema
- ring basis artifact schema

This ABI does not mutate canonical world artifacts.

## Canonical Rules

Unless an ABI says otherwise:

- JSON objects must have strict keysets (unknown keys reject, missing keys reject).
- Leaf scalars must be strings (“string membrane”).
- Digests use `sha256:<64 lowercase hex>`.
- Hash payloads use canonical JSON:
  - UTF-8
  - lexicographic key ordering
  - no extra whitespace
  - ends with exactly one newline (`0x0A`) which is included in the hash

NDJSON logs must be one canonical JSON object per line, newline-terminated, and must not contain trailing bytes after the final newline.

## Public Address Space

Fixed ring:

- `P = {0..239}`

## Function Binding (required)

Each trace stream must declare:

- `turn_clock_id`
- `turn_project_id`
- `reflect_id`

Allowed IDs are frozen in:

- `docs/WAVE27_POINTER_SYNC_FUNCTIONS.md`

Unknown IDs must reject.

## Public State

Public state at step `t`:

```txt
(p, c241, k)
```

Constraints:

- `p` is decimal string in range `0..239`
- `c241` is bit string (`"0"` or `"1"`)
- `k` is decimal string in range `1..6`

## Private Inputs (not emitted)

Each participant keeps:

- `c7` bit
- `outer[0..5]` bits

Derived local values per step:

- `line = outer[k]`
- `r = c7 XOR c241`

Private values are never emitted directly in public artifacts.

## Commit Rule

For each step, peers compute:

- `pA' = TURN_project(...)`
- `pB' = TURN_project(...)`

Commit iff:

- `pA' == pB'`

On commit:

- `p_next = pA'`
- `c241_next = REFLECT(p_next)`
- `k_next = (k mod 6) + 1`

On fail:

- `p_next = p`
- `k_next = k` (freeze)
- status `fail`

## Ring Basis Artifact

Type: `wave27.ring_basis.v0`

Top-level keyset (exact):

- `v`
- `authority`
- `size`
- `basis`
- `digest`

Rules:

- `v` must be `wave27.ring_basis.v0`
- `authority` must be `advisory`
- `size` must be `"240"`
- `basis` must be `"identity"`
- `digest` must match canonical payload hash

`ring_fingerprint` for trace artifacts equals this artifact's `digest`.

## Trace Record

Type: `wave27.pointer_sync.v0` (NDJSON line object).

Top-level keyset (exact):

- `v`
- `authority`
- `turn_clock_id`
- `turn_project_id`
- `reflect_id`
- `step`
- `k`
- `p_before`
- `p_after`
- `c241_before`
- `c241_after`
- `status`
- `ring_fingerprint`
- `digest`

Rules:

- `authority` must be `advisory`
- `status` enum: `commit|fail`
- pointer fields are decimal strings in `0..239`
- `k` is decimal string in `1..6`
- centroid fields are bit strings (`"0"|"1"`)
- `ring_fingerprint` must be `sha256:<64hex>`
- `digest` must be canonical payload hash without `digest`

## Residual Artifact

Type: `wave27.pointer_sync_residual.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `turn_clock_id`
- `turn_project_id`
- `reflect_id`
- `fail_k`
- `p_before`
- `candidate_a`
- `candidate_b`
- `ring_fingerprint`
- `digest`

Rules:

- `authority` must be `advisory`
- `fail_k` is decimal string in `1..6`
- pointer candidates are decimal strings in `0..239`
- `digest` must be canonical payload hash without `digest`

## Replay Requirement

Verifier recomputes each step using:

- declared function IDs
- frozen functions/constants in `docs/WAVE27_POINTER_SYNC_FUNCTIONS.md`
- ring fingerprint binding

Any mismatch in recomputed state must reject.

## Must-Reject

Reject on:

- unknown/missing function IDs
- unknown/missing keys
- invalid ranges/enum values
- authority not `advisory`
- ring fingerprint mismatch vs supplied `wave27.ring_basis.v0`
- digest mismatch
- replay mismatch

