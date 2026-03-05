# WAVE27 Trace Spine ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: deterministic mapping from append-only Wave27 trace records to Merkle leaves, segment roots, and a spine root for inclusion proofs and partial replay.

## Scope

This ABI defines:

- step leaf hashing
- segment Merkle roots (fixed chunk size)
- spine root over segment roots
- step/segment inclusion proof schemas

This ABI is generic for trace streams that declare this mapping; primary target is `wave27.pointer_sync.v0`.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`

## Domain Separation Tags (exact)

- `tag_step = "wave27:step:v0\n"`
- `tag_segment = "wave27:segment:v0\n"`
- `tag_spine = "wave27:spine:v0\n"`
- `tag_pair = "wave27:pair:v0\n"`

## Segment Size

Fixed default:

- `seg_size = "64"` (decimal string)

## Step Leaf Hash

For canonical trace record `rec_i`:

```txt
leaf_i = sha256( tag_step || bytes(canonical_json(rec_i)) )
```

Record `digest` verification must pass before leaf construction.

## Pair Hash

For child raw digests `L`, `R`:

```txt
parent = sha256( tag_pair || L || R )
```

Order is left-right, never sorted.

If odd count at a level, duplicate last node.

## Segment Root

For contiguous segment `s` over step range:

- `step_start = s*64`
- `step_end = min((s+1)*64 - 1, last)`

Build Merkle root over `leaf_i` in that range using pair rules.

## Segment Artifact

Type: `wave27.trace_segment.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `trace_type`
- `seg_size`
- `seg_index`
- `step_start`
- `step_end`
- `leaf_count`
- `segment_root`
- `trace_fingerprint`
- `digest`

Rules:

- `authority` must be `advisory`
- numeric fields are decimal strings
- `segment_root` and `trace_fingerprint` are sha256 strings
- `digest` must match canonical payload hash

## Spine Root

Let ordered segment roots be `seg_root_0..seg_root_n`.

First compute segment leaves:

```txt
seg_leaf_s = sha256( tag_segment || raw_digest(seg_root_s) )
```

Then:

```txt
spine_root = merkle_root([seg_leaf_0..seg_leaf_n])
```

Trace fingerprint:

```txt
trace_fingerprint = sha256( tag_spine || raw_digest(spine_root) )
```

## Spine Artifact

Type: `wave27.merkle_spine.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `trace_type`
- `seg_size`
- `segment_count`
- `step_count`
- `trace_fingerprint`
- `spine_root`
- `segment_roots_digest`
- `digest`

Rules:

- `authority` must be `advisory`
- all digest fields are sha256 strings
- `segment_roots_digest` is hash of canonical JSON array of ordered segment-root strings
- `digest` must match canonical payload hash

## Step Inclusion Proof

Type: `wave27.step_proof.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `trace_fingerprint`
- `seg_size`
- `seg_index`
- `step_index`
- `leaf`
- `path`
- `segment_root`
- `digest`

`path[]` entry keyset:

- `dir`
- `hash`

Rules:

- `dir` enum: `L|R`
- `hash` is sha256 string
- fold path with pair hash; result must equal `segment_root`

## Segment Inclusion Proof

Type: `wave27.segment_proof.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `trace_fingerprint`
- `seg_index`
- `segment_root`
- `path`
- `spine_root`
- `digest`

`path[]` entry keyset:

- `dir`
- `hash`

Rules:

- recompute `seg_leaf` from `segment_root`
- fold path; result must equal `spine_root`

## Must-Reject

Reject on:

- unknown/missing keys
- malformed digest fields
- non-canonical JSON inputs
- step digest mismatch before leaf hashing
- invalid proof path direction
- proof fold mismatch
- invalid segment boundaries or ordering drift
- authority not `advisory`

