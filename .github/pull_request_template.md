# Metaverse Kit Release PR Checklist

This project is a protocol/runtime artifact.  
Releases must preserve deterministic behavior and authority boundaries.

Do not merge unless all boxes below are satisfied.

---

## Scope declaration

- [ ] This PR is:
  - [ ] bugfix
  - [ ] docs
  - [ ] tooling
  - [ ] release
  - [ ] protocol change (requires version bump)

Describe scope in one sentence:

> ____________________________________________

---

## Authority boundary check

- [ ] No canonical artifact is mutated by projection code
- [ ] Portal remains projection-only
- [ ] Proposal artifacts remain advisory
- [ ] No hidden authority path introduced
- [ ] Layer placement is explicit

If a new component was added:

Layer:

> ____________________________________________

Why this layer:

> ____________________________________________

---

## Determinism check

- [ ] `npm run release:pack` produces reproducible output
- [ ] `npm run release:verify` passes
- [ ] `bash scripts/demo-portal-eval.sh` passes
- [ ] No nondeterministic timestamps / random seeds / ordering drift

Notes:

> ____________________________________________

---

## Release discipline (for release PRs only)

- [ ] Version number declared
- [ ] RELEASE_NOTES updated
- [ ] checksums verified
- [ ] demo.bundle verified on clean machine
- [ ] portal fails closed on corruption
- [ ] proposal export verified

Manifest digest:

```

---

```

---

## Protocol change gate (only if applicable)

If this PR changes protocol semantics:

- [ ] Version bumped
- [ ] ABI docs updated
- [ ] Frozen docs updated
- [ ] Migration notes written
- [ ] Backward compatibility addressed

Protocol change summary:

> ____________________________________________

---

## Reviewer checklist

Reviewer must confirm:

- [ ] Scope matches declaration
- [ ] No silent authority expansion
- [ ] Determinism preserved
- [ ] Docs match behavior
- [ ] Release discipline followed

Reviewer name:

> ____________________________________________

---

## Final statement

I affirm this PR preserves the deterministic and authority discipline of the system.

Author:

> ____________________________________________
