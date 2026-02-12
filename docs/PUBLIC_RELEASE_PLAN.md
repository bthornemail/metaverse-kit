# Public Release Plan - Metaverse Kit v0.1

This document defines the execution plan for publishing v0.1
and the discipline required immediately after release.

This is a protocol artifact launch, not a feature launch.

---

## Stage 0 - Final Freeze (T-24h)

Goal: eliminate uncertainty before tag.

### Checklist

- [ ] All CI green
- [ ] release:pack reproducible locally
- [ ] release:verify passes
- [ ] demo-portal-eval passes
- [ ] docs index builds clean
- [ ] runbook matches reality
- [ ] announcement reviewed

### Actions

- No merges except release-critical fixes
- No dependency upgrades
- No formatting churn
- No refactors
- No "while we're here" edits

Freeze means freeze.

---

## Stage 1 - Canonical Tag (T-0)

### Operator commands

```bash
git status
git tag v0.1
git push origin v0.1
npm run release:pack
npm run release:verify
```

Record:

- manifest digest
- tail digest
- release checksums

These become audit anchors.

---

## Stage 2 - Artifact Publication

### GitHub release

Title:
Metaverse Kit v0.1 - Deterministic World Demo

Attach:

`dist/metaverse-kit-v0.1/`

Must include:

- demo.bundle/
- portal/
- checksums.txt
- docker-image.txt (if Docker envelope published)
- RELEASE_NOTES.md

### Post-upload verification

Download from GitHub on a clean machine:

```bash
sha256sum --check checksums.txt
npm run mv-verify-demo -- --bundle demo.bundle
```

If verification fails:

STOP.  
Do not announce.

---

## Stage 3 - Public Announcement

Channels:

- GitHub release page
- blog / devlog
- Discord / community
- technical social post

Positioning:

> infrastructure demo
> deterministic artifact system
> verifiable worlds
> protocol discipline

Avoid:

- hype framing
- game framing
- XR spectacle framing

This is a systems launch.

---

## Stage 4 - Live Demo Window

First 24 hours after release:

- run 90-second demo script
- record replay
- publish video
- capture questions
- document confusion points

Do not:

- hotfix live
- push silent changes
- re-upload assets

All fixes go to v0.1.1.

---

## Stage 5 - Post-Release Discipline

Immediately after launch:

### Patch policy

v0.1.x:

- bugfix only
- deterministic fixes
- docs clarifications
- tooling stability

Forbidden in patch line:

- protocol semantics
- authority boundary change
- artifact format drift

### Issue triage labels

- reproducibility
- verification
- packaging
- docs
- UX confusion
- protocol (requires roadmap discussion)

---

## Stage 6 - Stability Observation Period

Duration: 2-4 weeks

Goal: learn from real users without destabilizing protocol.

Metrics:

- bundle verification success rate
- corruption detection reliability
- replay determinism reports
- user confusion around authority boundaries
- onboarding friction

This data informs v0.2.

---

## Release Success Criteria

v0.1 is successful if:

- artifacts verify across machines
- portal fails closed reliably
- replay is deterministic
- proposal export is reproducible
- users understand authority model
- no silent drift occurs

Feature adoption is not the metric.

Integrity is the metric.

---

## Emergency Protocol

If a critical flaw is found:

- publish SECURITY advisory
- freeze portal distribution
- document exact failure mode
- ship v0.1.1 patch
- preserve audit trail

Never rewrite history.  
Never replace assets silently.

---

## Guiding principle

A protocol launch is not a moment.

It is a commitment to discipline.

v0.1 is the first public promise
that artifacts remain trustworthy.

Everything after this builds on that trust.
