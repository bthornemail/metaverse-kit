# Release Runbook v0.1

Operational checklist for publishing `Metaverse Kit v0.1 — Deterministic World Demo`.

## Scope

- Release type: protocol/runtime/demo artifact
- Semantic scope: frozen (`v0.1`)
- Non-goal: feature work during release window

## Preconditions

- Working tree reviewed and intentional.
- CI checks green:
  - `npm run -s check:portal-contract`
  - `bash scripts/demo-portal-eval.sh`
  - release reproducibility workflow green

## Freeze sequence

1. Verify release scripts locally:

```bash
npm run release:pack
npm run release:verify
```

2. Tag exact commit:

```bash
git tag v0.1
git push origin v0.1
```

3. Rebuild once for publish payload from the tagged commit:

```bash
npm run release:pack
npm run release:verify
```

4. Record manifest digest for audit notes:

```bash
sha256sum dist/metaverse-kit-v0.1/demo.bundle/manifest.json
```

## Publish sequence

1. Create GitHub release from tag `v0.1`.
2. Title:
   - `Metaverse Kit v0.1 — Deterministic World Demo`
3. Description source:
   - first section of `RELEASE_NOTES.md`
4. Upload release asset directory contents from:
   - `dist/metaverse-kit-v0.1/`
5. Ensure uploaded payload includes:
   - `demo.bundle/`
   - `portal/`
   - `checksums.txt`
   - `RELEASE_NOTES.md`

## Verification checklist (post-upload)

- Download release assets on a clean machine.
- Verify checksums:

```bash
cd metaverse-kit-v0.1
sha256sum --check checksums.txt
```

- Verify bundle:

```bash
npm run -s mv-verify-demo -- --bundle demo.bundle
```

- Run portal locally:

```bash
python3 -m http.server 8787
# open http://localhost:8787/demo.bundle/portal/index.html
```

## Live demo script (90 seconds)

1. Show `checksums.txt`.
2. Verify bundle digest.
3. Corrupt one byte in a bundle file and show fail-closed behavior.
4. Reload clean bundle and replay.
5. Export a proposal artifact.
6. Show proposal digest.

## Post-release policy

- `v0.1.1` is bugfix-only.
- No semantic/protocol drift in patch line.
- Any protocol change requires new version and updated frozen docs.
