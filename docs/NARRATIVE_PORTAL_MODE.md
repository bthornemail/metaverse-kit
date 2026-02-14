# Narrative Portal Mode v0

Narrative Portal Mode maps story files into deterministic, advisory world states.

It is a projection layer over the existing spine.

**Freeze notice:** Wave 16.1 is frozen for `v0.1.x`.

## Inputs

- narrative corpus directory
- optional series/title metadata

## Output

- `wave16.narrative_state.v0` JSON artifact

## Tool

```bash
npm run -s mv-narrative-state-project -- \
  --root ../narrative-series/When\ Wisdom,\ Law,\ and\ the\ Tribe\ Sat\ Down\ Together \
  --out dev-docs/narrative/states.v0.json
```

## Layer rules

- advisory only (`authority=advisory`)
- no canonical mutation
- deterministic replay
- fail-closed on schema/path drift

## Portal integration

Runtime can render this model as:

- state list + transitions
- stance/topology overlays
- narrative commentary panel

Any interaction output must remain proposal-only.

## Wave 16.1 canonical walkthrough

Frozen path:

1. PRELUDE/02 (`PRELUDE/On the Turning Away from the Word .md`)
2. ARTICLE II (`ARTICLE II.md`)
3. Stance = `solon`
4. Generator = `wave16.gen.solon.constitution.v0`
5. Generate proposal

Artifacts:

- Interaction steps: `dev-docs/narrative/solon-path.steps.json`
- Interaction tape: `dev-docs/narrative/solon-path.tape.v0.json`
- Proposal output: `dev-docs/narrative/solon-constitution.proposal.v0.json`

Expected digests (base bundle `sha256:090c6c2a8a2ef694bfe1b8824caa542026499627fac4dd93d2149a865d4eb84a`):

- tape digest: `sha256:42cc0c5af3e4510450eaa0ac2d445746996c1f3d1d7e112c3e7b697eca888524`
- proposal digest: `sha256:a9049a2afb057e266b61725ab9d15bf2424af9f78dae307a32ab213c94c87a14`
