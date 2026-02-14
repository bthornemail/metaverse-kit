# External Tester Kit

This kit provides a 5-minute independent verification flow for release artifacts.

## Scope

The tester flow checks:

- release checksum integrity
- demo bundle verification
- deterministic replay
- deterministic proposal export
- optional signature verification

It does not mutate canonical artifacts.

## Prerequisites

- `bash`
- `sha256sum`
- `node` (v18+)
- release directory present locally (default: `dist/metaverse-kit-v0.1`)

Optional signature tools:

- `gpg` for `--signature-method gpg`
- `minisign` for `--signature-method minisign`
- `cosign` for `--signature-method cosign`

## Quick run

```bash
bash scripts/external-tester-smoke.sh --dist dist/metaverse-kit-v0.1
```

## Run with signature verification

### GPG

```bash
bash scripts/external-tester-smoke.sh \
  --dist dist/metaverse-kit-v0.1 \
  --verify-signatures \
  --signature-method gpg
```

### Minisign with inline public key

```bash
bash scripts/external-tester-smoke.sh \
  --dist dist/metaverse-kit-v0.1 \
  --verify-signatures \
  --signature-method minisign \
  --minisign-pubkey "RW..."
```

### Minisign with remote public key (explicit opt-in)

```bash
bash scripts/external-tester-smoke.sh \
  --dist dist/metaverse-kit-v0.1 \
  --verify-signatures \
  --signature-method minisign \
  --minisign-pubkey-url https://example.org/minisign.pub \
  --allow-remote-key
```

## Expected output

Successful run ends with:

```text
ok external tester smoke dist=dist/metaverse-kit-v0.1
```

Any mismatch or corruption must fail closed with `ERROR:` output.

## Narrative generator verification (Wave 16.1)

Run these after the base smoke flow:

```bash
npm run -s wave16:golden
npm run -s wave16:must-reject
```

This verifies the frozen narrative path:

- PRELUDE/02 -> ARTICLE II
- stance `solon`
- generator `wave16.gen.solon.constitution.v0`
- deterministic proposal output + reject corpus

## 30–60s demo capture (optional)

Use the bundled helper script to record a terminal cast and produce a GIF.

### Preferred path (asciinema + agg)

```bash
bash scripts/make-demo-gif.sh record-cast tester.cast
bash scripts/make-demo-gif.sh cast-to-gif tester.cast tester.gif
```

### Fallback path (mp4 -> gif via ffmpeg)

If you already have a screen recording (for example `tester.mp4`):

```bash
bash scripts/make-demo-gif.sh mp4-to-gif tester.mp4 tester.gif
```
