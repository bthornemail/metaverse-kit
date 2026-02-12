# Incident Response

Operational runbook for integrity or authority-boundary incidents.

## Scope

Applies to incidents affecting:

- bundle integrity verification
- deterministic replay consistency
- portal authority boundaries
- proposal artifact correctness

## Trigger conditions

Open incident response when any of the following occur:

- release assets fail checksum verification
- portal renders corrupted bundle without fail-closed refusal
- replay diverges for identical inputs across machines
- projection path mutates canonical artifacts

## Response phases

### 1) Detect

- capture exact failing command and output
- capture commit/tag and environment details
- collect affected artifacts (bundle, checksums, logs)

### 2) Contain

- pause new releases
- freeze related merges
- if needed, temporarily remove affected release download links

### 3) Verify scope

Run:

```bash
npm run -s check:portal-contract
bash scripts/demo-portal-eval.sh
npm run -s release:verify
```

Classify whether failure is:

- documentation/operator error
- tooling bug
- protocol boundary violation

### 4) Remediate

- implement minimal fix
- add/expand deterministic test coverage
- add must-reject case if applicable
- avoid semantic/protocol drift in patch line

### 5) Release patch

- ship patched version (`v0.1.x`)
- publish advisory with:
  - impact
  - affected versions
  - fix version
  - verification steps

### 6) Postmortem

- root cause
- why existing gates missed it
- gate/doc changes introduced
- follow-up owner and due date

## Decision matrix

- If authority boundary is crossed: treat as Critical.
- If fail-closed behavior is bypassed: treat as High/Critical.
- If issue is only docs mismatch: treat as Low, patch docs quickly.

## Non-negotiable rules

- No silent hotfix to published assets.
- No force-rewrite of release history.
- Every incident resolution must leave an auditable artifact trail.
