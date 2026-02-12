# Portal Layer Contract

Status: normative for demo portal and follow-on portal features.

## Purpose

Define non-negotiable authority and integrity boundaries for portal components.

The portal is an instrument in the projection layer. It is not an authority kernel.

## Layer declaration

- Layer: `projection`
- Authority class: `advisory`
- Inputs: canonical, content-addressed artifacts only
- Outputs: projection surfaces and proposal artifacts only

## Hard invariants

1. Canonical artifacts are read-only in portal/runtime code.
2. Integrity verification is mandatory before rendering.
3. UI state is never canonical truth.
4. Proposal artifacts are non-authoritative unless accepted by external authority paths.
5. Replay must be deterministic for identical inputs.

## Required runtime behavior

- Verify `integrity.sha256` against `manifest.json` bytes.
- Verify every listed asset hash and byte count before render.
- Fail closed on any mismatch.
- Refuse partial or best-effort render on failed verification.

## Proposal boundary

- Portal may emit proposal artifacts (for example `wave16.proposal_bundle.v0`).
- Proposal must bind to a specific base bundle digest.
- Proposal emission must not mutate canonical files or authoritative logs.
- Proposal acceptance/merge is outside portal authority.

## Forbidden behaviors

- Direct canonical mutation from portal code.
- Hidden in-memory authority that bypasses canonical acceptance.
- Network dependency for core replay/verification path.
- Silent schema drift in bundle/proposal formats.
- Treating projection/UI artifacts as authoritative state.

## Integration gate rule

Any portal change that touches verification, proposal generation, or replay logic must include:

- deterministic replay check
- integrity failure check (fail closed)
- proposal artifact validation check

Changes without these checks are blocked.

## Escalation rule

If a feature cannot be clearly placed in the projection layer without authority leakage, stop and route it through authority-layer design review before implementation.
