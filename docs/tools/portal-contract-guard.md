# portal-contract-guard

Fail-closed guard checks for the demo portal contract.

## Purpose

This guard enforces two invariants:

1. `docs/index.md` must reference `docs/portal-contract.md`.
2. Portal-critical code changes must include an update to `scripts/demo-portal-eval.sh`.

## Usage

```bash
npm run check:portal-contract
```

## CI / branch diff mode

Set `PORTAL_GUARD_BASE_REF` to compare against a base ref in CI:

```bash
PORTAL_GUARD_BASE_REF=origin/main npm run check:portal-contract
```

Without `PORTAL_GUARD_BASE_REF`, the script checks staged changes first, then unstaged changes against `HEAD`.

## Portal-critical paths

- `portal/*`
- `tools/mv-pack-demo/*`
- `tools/mv-verify-demo/*`
- `tools/mv-proposal-bundle/*`

If any of these change without `scripts/demo-portal-eval.sh` changing in the same diff, the guard fails.
