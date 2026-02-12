# SBOM and Provenance

This document defines the minimal supply-chain artifacts produced for release payloads.

## Scope

For each release payload (`dist/metaverse-kit-vX.Y/`), generate:

- `sbom-npm-ls.json` (dependency tree snapshot)
- `provenance.json` (build context + artifact digests)

These artifacts are additive and non-authoritative. Canonical release truth remains checksums + deterministic verification path.

## Generate locally

```bash
npm run -s release:pack
npm run -s release:sbom
```

Outputs are written into the release dist directory.

## Verify

```bash
jq '.schema' dist/metaverse-kit-v0.1/provenance.json
jq '.name' dist/metaverse-kit-v0.1/sbom-npm-ls.json
```

## Provenance fields

`provenance.json` includes:

- git commit/tag (if available)
- node/npm versions
- UTC build timestamp (for audit context)
- checksums digest
- demo bundle manifest digest

## Notes

- SBOM/provenance are transparency artifacts.
- They do not change compatibility or authority boundaries.
- If these artifacts are missing in a release pipeline, treat as release-quality regression.
