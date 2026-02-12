# Threat Model — Metaverse Kit

This document defines the adversary assumptions behind
Metaverse Kit’s integrity and release guarantees.

It explains what the system is designed to resist,
what it explicitly does not attempt to resist,
and where responsibility shifts to operators.

This is not a security marketing document.
It is an engineering boundary document.

---

## Scope

This threat model covers:

- release artifacts
- deterministic bundle packaging
- portal verification
- proposal artifacts
- reproducibility guarantees
- integrity pipelines

It does NOT cover:

- operating system compromise
- physical device compromise
- user endpoint malware
- network-layer censorship
- social engineering

Those are outside protocol scope.

---

## Security goals

The system guarantees:

1. Artifact integrity  
   Users can detect any modification of release artifacts.

2. Deterministic replay  
   Identical artifacts produce identical results.

3. Fail-closed behavior  
   Corruption halts execution instead of degrading silently.

4. Authority boundary preservation  
   Projection layers cannot mutate canonical artifacts.

5. Explicit proposal quarantine  
   Proposal artifacts cannot silently rewrite truth.

6. Reproducible release surface  
   Build outputs are stable across environments.

These are integrity guarantees, not confidentiality guarantees.

---

## Adversary classes

### A1 — Passive corruption

Examples:

- storage bitrot
- transfer truncation
- accidental file edits
- packaging mistakes

Defense:

- checksums
- manifest digests
- fail-closed portal verification
- reproducible packaging

Outcome: corruption is detected.

---

### A2 — Active artifact tampering

Examples:

- malicious mirror modification
- CDN injection
- compromised download path
- altered bundle contents

Defense:

- cryptographic digests
- signed release artifacts
- independent verification

Outcome: tampering is detectable.

The attacker cannot produce a valid digest
without the signing key.

---

### A3 — Confused operator

Examples:

- loading wrong bundle
- mixing artifact versions
- misreading projection output as authority
- trusting unverified proposal artifacts

Defense:

- explicit authority boundaries
- portal verification UI
- documentation discipline
- proposal quarantine

Outcome: mistakes are visible, not silent.

---

### A4 — Malicious extension or plugin

Examples:

- custom renderer rewriting artifacts
- external tooling mutating bundles
- adapter leaking authority

Defense:

- canonical artifacts are read-only
- portal treats bundles as immutable
- proposal export is explicit

Extensions can lie,
but they cannot rewrite canonical truth.

---

## Out-of-scope adversaries

The system does NOT attempt to defend against:

- root compromise of the host machine
- browser engine exploits
- malicious JavaScript injection outside bundle scope
- kernel-level tampering
- hardware keylogging
- operator coercion
- stolen signing keys

These require external operational security.

Metaverse Kit assumes:

the execution environment is not already hostile.

---

## Trust anchors

The trust model depends on:

- release signing keys
- documented verification steps
- deterministic packaging scripts
- public audit trail of tags and releases

If signing keys are compromised:

- incident response procedures apply
- keys must rotate
- new release lineage must be declared

History is never rewritten.

---

## Failure philosophy

Silent corruption is the primary threat.

The system is designed to prefer:

refusal over degradation

If integrity cannot be proven,
execution stops.

This is intentional.

Availability is sacrificed to preserve trust.

---

## Residual risk

Even with all controls:

- users may skip verification
- operators may trust unsigned artifacts
- forks may remove safeguards
- UI layers may mislead

The protocol cannot force discipline.

It can only make discipline possible.

---

## Security posture summary

Metaverse Kit is an integrity-first system.

It guarantees:

- verifiable artifacts
- deterministic replay
- explicit authority separation

It does not promise:

- anonymity
- confidentiality
- censorship resistance
- endpoint hardening

Those belong to other layers.

---

## Guiding principle

A world you cannot verify
is not a world you should trust.

Everything in this system exists
to make verification routine.
