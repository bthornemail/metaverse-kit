# Contributing

Metaverse Kit is a protocol/toolchain repo. The main job of contributors is to preserve determinism and authority boundaries while improving tooling, docs, and projections.

## Non-negotiables

- Canonical artifacts are read-only from portal/projection code.
- Projection/UI state is never truth.
- Advisory artifacts must be explicitly marked `authority:"advisory"`.
- Any semantic/protocol change must be versioned and must include must-reject coverage.

## Quick Start (local dev)

```bash
npm ci
npm run -s release:pack
npm run -s release:verify
```

Run the portal against the packaged bundle:

```bash
python3 -m http.server --directory dist/metaverse-kit-v0.1 8080
```

Then open `http://localhost:8080/portal/index.html`.

## Required checks before PR

Minimum gates for any PR that touches portal, tools, or protocol artifacts:

```bash
npm run -s check:portal-contract
./scripts/no-authority-check.sh
npm run -s release:verify
```

Full spine (slower, but required before release tags):

```bash
cd /home/main/devops
./scripts/closure-spine-smoke.sh
```

## How to add a new “Wave” (ABI + validator + corpus)

Every wave must ship as an invariant layer, not a feature blob.

Additions required:

1. ABI doc under `docs/` (example: `docs/WAVE24_FEDERATION_ABI.md`)
2. Tool under `tools/` with strict `emit` and `validate` modes
3. Golden fixture(s) under `dev-docs/`
4. Must-reject corpus script(s) under `scripts/`
5. CI guard under `.github/workflows/`
6. `docs/index.md` entry for the ABI + tool docs
7. Spine integration (repo root: `/home/main/devops/scripts/closure-spine-smoke.sh`)

Validation rules:

- strict keysets (unknown keys reject)
- string membrane (leaf scalars are strings)
- canonical JSON for hashing (`\\n` newline included)
- digest recomputation in validators (fail closed on mismatch)

## Termux contributor workflow (Android)

Termux is treated as an environment envelope.

```bash
npm run -s termux:bootstrap
npm run -s termux:freeze
npm run -s termux:verify-env
npm run -s termux:bundle:incremental
```

If you rsync this repo to a device, do not rsync `node_modules`. Always run `npm ci` on-device.

## Where to start

- If you want to help ship: improve `release:*` scripts, signature enforcement, external tester flows.
- If you want to help the protocol: expand must-reject corpora and alignment/federation conflict coverage.
- If you want to help UX: portal views are welcome, but must remain projection-only and must keep verification visible.

