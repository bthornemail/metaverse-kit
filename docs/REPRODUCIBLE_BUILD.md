# Reproducible Build Guide

This guide defines how to rebuild release artifacts from source and verify byte-level identity.

## Goal

Given the same tagged source, different operators should produce equivalent release artifacts and matching verification outputs.

## Preconditions

- Use a clean checkout of a release tag (example: `v0.1`).
- Use supported Node runtime (Node 20 recommended for CI parity).
- Run on a trusted machine (endpoint compromise is out of protocol scope).

## Clean-room rebuild

```bash
git clone https://github.com/bthornemail/metaverse-kit.git
cd metaverse-kit
git checkout v0.1
npm ci
npm run -s release:pack
npm run -s release:verify
```

Expected result:

- `dist/metaverse-kit-v0.1/` exists
- `release:verify` passes fail-closed

## Digest checks

Record and compare:

```bash
sha256sum dist/metaverse-kit-v0.1/demo.bundle/manifest.json
sha256sum dist/metaverse-kit-v0.1/checksums.txt
cat dist/metaverse-kit-v0.1/docker-image.txt 2>/dev/null || true
```

At minimum, `demo.bundle/manifest.json` digest must match across rebuilds for equivalent environments.

## Determinism gate checks

Run project gates:

```bash
npm run -s check:portal-contract
bash scripts/demo-portal-eval.sh
```

These enforce:

- portal contract invariants
- deterministic replay
- fail-closed corruption handling
- proposal export consistency

## Docker envelope reproducibility (optional)

```bash
npm run -s release:docker
npm run -s release:docker-smoke
```

The Docker image is a transport envelope only; canonical truth remains the release payload in `dist/metaverse-kit-v0.1/`.

## Troubleshooting mismatch

If digests differ:

1. Confirm same git tag/commit.
2. Confirm same Node major version.
3. Re-run from clean workspace.
4. Confirm no local file mutation in `dist/` between pack and verify.
5. Compare `checksums.txt` line-by-line.

If mismatch persists, open an incident using `.github/ISSUE_TEMPLATE/incident.md`.

## Non-goals

This guide does not define binary reproducibility for the entire toolchain ecosystem.
It defines reproducibility for the release artifact path in this repository.
