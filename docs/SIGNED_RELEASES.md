# Signed Releases

This project publishes deterministic artifacts. Signing adds publisher authenticity on top of integrity.

## Threat model

Checksums prove internal consistency.
Signatures prove who published the release.

Use signatures to protect against:

- release asset substitution
- mirror tampering
- impersonated publisher uploads

## Scope

Sign these artifacts for each release:

- git tag (`vX.Y.Z`)
- `checksums.txt`
- optional: `demo.bundle/manifest.json`

## Preferred methods

Order of preference:

1. Sigstore/cosign
2. minisign
3. GPG

The project supports all three through one script.

## Release signing workflow

After `release:pack`:

```bash
bash scripts/release-sign.sh --dist dist/metaverse-kit-v0.1 --method minisign
```

This creates signature files in the release directory.

### Minisign key source options

Default behavior uses `~/.minisign/minisign.key`.

You can also provide the minisign secret key at signing time:

- Secret key file:

```bash
bash scripts/release-sign.sh --dist dist/metaverse-kit-v0.1 --method minisign \
  --minisign-key-file /path/to/minisign.key
```

- Paste key from terminal stdin:

```bash
cat /path/to/minisign.key | \
  bash scripts/release-sign.sh --dist dist/metaverse-kit-v0.1 --method minisign \
    --minisign-key-stdin
```

- Remote key fetch (explicit opt-in):

```bash
bash scripts/release-sign.sh --dist dist/metaverse-kit-v0.1 --method minisign \
  --minisign-key-url https://example.org/minisign.key --allow-remote-key
```

Remote secret key usage is discouraged for routine releases.
Preferred workflow is local, offline signing.

Verify signatures before announcement:

```bash
bash scripts/release-verify-signatures.sh --dist dist/metaverse-kit-v0.1 --method minisign
```

To verify with an inline or remote minisign public key:

```bash
bash scripts/release-verify-signatures.sh --dist dist/metaverse-kit-v0.1 --method minisign \
  --minisign-pubkey "RWT..."
```

```bash
bash scripts/release-verify-signatures.sh --dist dist/metaverse-kit-v0.1 --method minisign \
  --minisign-pubkey-url https://example.org/minisign.pub --allow-remote-key
```

## Publishing requirements

A signed release must publish:

- `checksums.txt`
- signature file(s)
- public key reference
- verification command snippet

## Non-negotiable rules

- Never publish unsigned artifacts as final release.
- Never rotate keys silently.
- Never replace signatures without a new release entry.
