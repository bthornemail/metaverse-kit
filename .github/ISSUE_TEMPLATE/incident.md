---
name: Incident Report
about: Report integrity, reproducibility, or release incident
title: "[INCIDENT] "
labels: incident
assignees: ""
---

This template is for operational incidents:
release failures, checksum mismatches,
verification drift, replay inconsistencies.

---

## Incident type

- [ ] release artifact mismatch
- [ ] checksum failure
- [ ] reproducibility drift
- [ ] CI gate regression
- [ ] portal verification failure
- [ ] corrupted bundle detection
- [ ] authority boundary violation
- [ ] other:

---

## Severity

- [ ] low — cosmetic/docs
- [ ] medium — tooling friction
- [ ] high — integrity risk
- [ ] critical — trust breach

---

## Environment

OS / Node version / runtime context.

---

## What happened

Clear timeline of events.

---

## Expected result

What should have occurred.

---

## Actual result

What occurred instead.

---

## Artifacts

If safe:

- manifest digest
- checksum lines
- tail digest
- log excerpt

Never attach sensitive payloads.

---

## Immediate mitigation

What was done to stabilize.

---

## Follow-up needed

- [ ] patch release
- [ ] docs clarification
- [ ] CI update
- [ ] tooling fix
- [ ] protocol discussion
