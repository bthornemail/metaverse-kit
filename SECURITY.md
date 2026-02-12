# Security Policy

Metaverse Kit is a protocol/runtime artifact system. Security issues are handled with artifact integrity and deterministic replay as first-class constraints.

## Supported versions

Current supported line:

- `v0.1.x`

Older versions may not receive fixes.

## Reporting a vulnerability

Report privately with:

- affected version/tag
- reproduction steps
- impact statement
- proof artifact(s): bundle, checksums, logs, proposal artifact

Contact:

- Maintainer email in `README.md`

Do not open a public issue for unpatched critical vulnerabilities.

## Severity model

### Critical

- canonical/projection authority boundary bypass
- integrity verification bypass
- silent canonical mutation path
- deterministic replay identity break across machines

### High

- fail-closed checks can be bypassed with malformed artifacts
- release verification mismatch not detected

### Medium

- proposal artifact validation gaps
- non-authoritative UI state can be misrepresented as canonical

### Low

- documentation mismatch
- non-security operational friction

## Coordinated disclosure process

1. Private report received
2. Reproduction with provided artifacts
3. Scope and severity classification
4. Patch developed on fix branch
5. Determinism + integrity tests run
6. Security advisory published
7. Patched release published (`v0.1.x`)

## Security release rules

- Never replace published assets silently.
- Never rewrite release history.
- Publish new patched release with explicit advisory.
- Include checksums and verification instructions.

## Security checklist for fixes

- `npm run -s check:portal-contract`
- `bash scripts/demo-portal-eval.sh`
- `npm run -s release:pack`
- `npm run -s release:verify`

A security fix that fails deterministic/integrity gates does not ship.
