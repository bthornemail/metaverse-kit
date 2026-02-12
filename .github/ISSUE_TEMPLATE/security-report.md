---
name: Security Report
about: Report a potential security or integrity issue
title: "[SECURITY] "
labels: security
assignees: ""
---

⚠️ Do NOT include exploit details if this repo is public.

If this is an active vulnerability:
→ Follow SECURITY.md private reporting instructions first.

This template is for tracking and triage after disclosure coordination.

---

## Summary

Short description of the issue.

---

## Impact

What breaks?

- integrity verification
- deterministic replay
- authority boundaries
- artifact trust
- portal fail-closed guarantees
- other:

Explain worst-case impact.

---

## Affected components

List packages / scripts / tools involved.

- [ ] release pipeline
- [ ] bundle verification
- [ ] portal runtime
- [ ] proposal export
- [ ] protocol artifacts
- [ ] CI/reproducibility
- [ ] docs mismatch
- [ ] other:

---

## Reproduction steps

Minimal steps to trigger.

Do NOT include weaponized payloads.

---

## Expected behavior

What should have happened.

---

## Observed behavior

What actually happened.

---

## Mitigation ideas (optional)

If you have a safe fix suggestion.

---

## Reporter notes

Anything else relevant.
