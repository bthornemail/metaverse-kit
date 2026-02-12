# Compatibility Contract

This document defines what is stable across versions.

## Versioning model

- MAJOR: protocol or authority model changes
- MINOR: additive backward-compatible capability
- PATCH: bugfix only, no semantic drift

## v0.1 guarantees

For `v0.1.x`:

- canonical artifact schemas remain stable
- portal remains projection-only
- proposal artifacts remain advisory
- deterministic replay identity is preserved for identical inputs
- integrity verification remains fail-closed

## Patch line constraints (`v0.1.x`)

Allowed:

- bug fixes
- performance improvements without semantic change
- docs clarifications
- test and CI hardening

Forbidden:

- protocol field changes
- authority boundary changes
- artifact format drift
- hidden compatibility breaks

## Compatibility break policy

Any compatibility break requires:

1. MAJOR or MINOR version bump (as appropriate)
2. explicit migration notes
3. updated frozen docs
4. replay impact statement

## Deprecation policy

- no silent deprecations
- deprecations must include replacement path
- deprecation window must be documented before removal

## Source of truth

If implementation and docs diverge:

- patch line: fix implementation/docs to restore contract
- protocol change: bump version and document migration
