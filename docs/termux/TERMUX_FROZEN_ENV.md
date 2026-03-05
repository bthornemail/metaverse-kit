# Termux Frozen Environment

Goal: make `metaverse-kit` builds reproducible and incremental on Termux by pinning JS dependencies via `package-lock.json` and recording the Termux toolchain surface.

This is an environment *envelope*. It does not add authority and does not modify protocol semantics.

## Bootstrap

```bash
npm run -s termux:bootstrap
```

What it does:

- installs a minimal toolchain (`nodejs-lts`, `git`, `python`, `clang`, `make`, `jq`)
- runs `npm ci`

## Freeze (record this device/toolchain)

```bash
npm run -s termux:freeze
```

Writes:

- `docs/termux/env.lock.json`

## Verify (fail closed)

```bash
npm run -s termux:verify-env
```

This verifies:

- required commands exist
- Node major version is supported
- Node/NPM versions match the recorded lock (strict)

## Incremental build

```bash
npm run -s bundle:incremental
```

This performs an incremental release-bundle build by skipping `release:pack` when inputs are unchanged, then always running `release:verify`.
