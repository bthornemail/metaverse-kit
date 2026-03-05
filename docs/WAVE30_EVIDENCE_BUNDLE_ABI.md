# WAVE30 Evidence Bundle ABI

Status: experimental advisory protocol surface.

Authority class: `advisory`.

Purpose: deterministic packaging of evidence artifact references as a portable digest-bound set.

## Canonical Rules

Unless an ABI says otherwise:

- strict keysets
- string membrane for leaf scalars
- canonical JSON hashing with one trailing newline
- digest format `sha256:<64 lowercase hex>`
- arrays are allowed; all leaf scalars must be strings

## Artifact

Type: `wave30.evidence_bundle.v0`.

Top-level keyset (exact):

- `v`
- `authority`
- `subject_digest`
- `claim_type`
- `evidence`
- `evidence_digest`
- `digest`

Rules:

- `v` must be `wave30.evidence_bundle.v0`
- `authority` must be `advisory`
- `subject_digest` must be `sha256:<64hex>`
- `claim_type` is non-empty string
- `evidence` is non-empty array sorted by `(v,digest)`
- `evidence_digest` is `sha256(canonical_json(evidence))`
- `digest` is canonical payload hash without `digest`

## `evidence[]` keyset (exact)

- `v`
- `digest`

Rules:

- `v` must be a supported advisory artifact type
- `digest` must be `sha256:<64hex>`

## Must-Reject

Reject on:

- unknown/missing keys
- authority not `advisory`
- malformed digest fields
- non-string leaves
- duplicate evidence entries
- evidence ordering mismatch
- evidence_digest mismatch
- digest mismatch
