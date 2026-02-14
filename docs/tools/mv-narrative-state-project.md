# `mv-narrative-state-project`

Deterministic projector for Narrative Portal Mode.

## Usage

```bash
npm run -s mv-narrative-state-project -- \
  --root ../narrative-series/When\ Wisdom,\ Law,\ and\ the\ Tribe\ Sat\ Down\ Together \
  --out dev-docs/narrative/states.v0.json
```

## Output

Produces `wave16.narrative_state.v0` JSON:

- strict keysets
- string membrane
- advisory authority marker
- per-state and model digests

## Reject behavior

The tool fails closed on:

- hidden paths
- symlinks
- unsupported file extensions
- section inference failures
