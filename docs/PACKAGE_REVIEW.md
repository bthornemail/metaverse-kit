# Package Review (metaverse-kit + light-garden + geometry-spine)

## Scope
This review covers three local repos:
- `/home/main/devops/metaverse-kit`
- `/home/main/devops/light-garden`
- `/home/main/devops/geometry-spine`

Goal: assess package structure, testability, release readiness, and integration gaps.

## Snapshot
- `metaverse-kit`: commit `ab7580d`, branch `main`, lockfile present, working tree dirty
- `light-garden`: commit `138a787`, branch `main`, `audit/package-lock.json` present, `wordnet/package-lock.json` missing, working tree dirty
- `geometry-spine`: commit `5187a7e`, branch `main`, root + `webauthn` lockfiles present, working tree dirty

---

## Executive Summary
- `metaverse-kit` is structurally strongest as a packaging/release monorepo.
- `light-garden` has a capable audit harness, but core validate run currently reports failures.
- `geometry-spine` package tests fail in local mode because authority gate pathing is hardcoded to a missing environment path.
- Cross-repo integration is close, but authority gate wiring is the main blocker for reliable local verification.

Overall status: **Partially ready** (good packaging foundations, incomplete integrated verification).

---

## Repo-by-Repo Review

## 1) metaverse-kit
### Package Topology
- Monorepo with workspaces:
  - `packages/*` (9)
  - `apps/*` (4)
  - `tools/*` (26)
- Workspace totals:
  - `39` package manifests
  - `13` with `build` scripts
  - `8` with `test` scripts

### Validation Evidence
Command:
- `npm run -s release:verify`

Result:
- **PASS**
- Verified canonical + portal bundle files and checksums
- `ok verify-release dist=dist/metaverse-kit-v0.1`

Command:
- `npm run -s test --workspaces --if-present`

Result:
- **PASS (with caveat)**
- Some workspaces output placeholder `Tests coming soon`
- Actual automated tests observed for at least `shadow-canvas` and `tilestore`

### Risks
- Large tool surface (26 tool packages) with uneven test coverage.
- Placeholder tests reduce confidence for cross-wave regressions.

### Recommendations
1. Require non-placeholder tests for critical tool packages (`mv-*` that affect ABI/wave validation).
2. Add a workspace-level coverage report to make untested packages explicit in CI output.
3. Keep `release:verify` as mandatory pre-release gate.

---

## 2) light-garden
### Package Topology
- JS audit package at `audit/package.json`
- Legacy WordNet package metadata at `wordnet/package.json`
- Native component in `c-server/Makefile`

### Validation Evidence
Command:
- `npm --prefix ./audit run validate --silent`

Result:
- **FAIL**
- Summary: `Passed: 29`, `Failed: 11`
- Report path: `light-garden/audit/artifacts/reports`

Command:
- `npm --prefix ./audit run features:audit --silent`

Result:
- **PASS (core)**
- Core tests: all capabilities show `Core ... 100%`
- Coverage exception: `mesh-networking` total `13/14 (92.9%)`

### Risks
- Core audit validate still failing despite strong feature-core scores.
- Potential disconnect between trace-level validation and feature adapters.
- `wordnet` package has no lockfile and no real test script.

### Recommendations
1. Triage the 11 failing validate tests first (wordnet-service, c-server, firmware-negative traces).
2. Treat `features:audit` and `validate` as separate quality gates; both must pass for freeze.
3. Add/commit `wordnet/package-lock.json` if Node-based workflows are expected there.

---

## 3) geometry-spine
### Package Topology
- Root package `@geometry-spine/core`
- Additional `webauthn` package
- Ops/packaging assets: Dockerfiles, k8s, install scripts, web3-bootstrap

### Validation Evidence
Commands:
- `bash ./rpc/mcp-gateway/test-mcp.sh`
- `bash ./rpc/mcp-gateway/test-http.sh`

Result:
- **FAIL (environment/config)**
- All test cases return HALT with:
  - `"message":"HALT: Authority gate missing"`

### Root Cause
`mcp-server.js` defaults to authority file path:
- `/root/metaverse/invariants/authority/AuthorityProjection.hs`

In this local setup, that path is not available, so strict authority mode blocks all requests.

### Risks
- Test suite appears broken even when tool logic may be correct.
- Local dev confidence is reduced because authority dependency is implicit and externalized.

### Recommendations
1. Make authority dependency explicit in docs and scripts:
   - Require `AUTHORITY_GATE_PATH` env var in test wrappers.
2. Add a local deterministic fixture gate for dev mode, while keeping strict mode for production.
3. Split test profiles:
   - `test:unit` (no external authority file)
   - `test:authority` (strict, with real gate path)

---

## Cross-Repo Integration Findings
1. `metaverse-kit` packaging/release verification is healthy.
2. `light-garden` audit framework is mature but not fully green (`validate` failures remain).
3. `geometry-spine` fails closed correctly, but path coupling to `/root/metaverse` prevents local integrated tests.

### Primary Blocker to “full green”
- **Authority gate path/config mismatch across repos and environments.**

---

## Freeze Readiness Matrix
- `metaverse-kit` release packaging: **Ready**
- `metaverse-kit` workspace test depth: **Partial**
- `light-garden` core feature audit: **Ready**
- `light-garden` full validate suite: **Not Ready**
- `geometry-spine` local MCP/HTTP tests: **Not Ready (config/pathing)**
- Cross-repo deterministic integration: **Not Ready**

Overall freeze verdict: **NO-GO** until the two blockers are resolved:
1. `light-garden` validate failures reduced to zero
2. `geometry-spine` authority gate wired for this local environment

---

## Action Plan (Integrity-Preserving)
1. Standardize authority config contract across all repos:
   - `AUTHORITY_GATE_PATH`
   - `AUTHORITY_STRICT`
2. Add one shared integration smoke script in `metaverse-kit` that runs:
   - `light-garden` validate
   - `geometry-spine` authority tests
   - `metaverse-kit` release verify
3. Promote freeze only when all three pass in the same environment snapshot.

---

## Commands Used for This Review
- `npm run -s release:verify` (metaverse-kit)
- `npm run -s test --workspaces --if-present` (metaverse-kit)
- `npm --prefix ./audit run validate --silent` (light-garden)
- `npm --prefix ./audit run features:audit --silent` (light-garden)
- `bash ./rpc/mcp-gateway/test-mcp.sh` (geometry-spine)
- `bash ./rpc/mcp-gateway/test-http.sh` (geometry-spine)

Log files:
- `/tmp/review-metaverse-kit-release.log`
- `/tmp/review-metaverse-kit-tests.log`
- `/tmp/review-light-garden-audit.log`
- `/tmp/review-geometry-tests.log`
- `/tmp/review-metaverse-benchmark_all.log`
