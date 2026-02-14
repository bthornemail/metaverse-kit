# WAVE16 Narrative State ABI

Status: frozen for Narrative Portal Mode v0 bootstrap.

## Purpose

`wave16.narrative_state.v0` is a projection-only model that maps narrative files into deterministic portal states.

This model is advisory and non-authoritative.

## Canonical rules

- UTF-8 JSON
- sorted keys
- compact separators
- trailing newline
- strict keysets
- string membrane for leaf scalars
- digests use `sha256:<64hex>`

## Top-level keyset (exact)

- `authority`
- `digest`
- `narrative_root`
- `series`
- `states`
- `structure`
- `summary`
- `title`
- `v`

Rules:

- `v` MUST be `wave16.narrative_state.v0`
- `authority` MUST be `advisory`
- `digest` MUST be sha256 of canonical JSON of the model without `digest`

## State object keyset (exact)

- `authority`
- `dialogue_roles`
- `digest`
- `id`
- `line_count`
- `projections`
- `section`
- `source_digest`
- `source_path`
- `stance`
- `title`
- `topology`
- `transitions`
- `word_count`

Rules:

- `authority` MUST be `advisory`
- `id` is digest of canonical source path string
- `source_digest` is digest of exact source bytes
- `digest` is digest of canonical JSON of the state without `digest`
- `section` enum: `prelude|article|aside|epilogue`
- `stance` enum: `solon|solomon|asabiyyah|metatron|balance`

## Non-authority rule

Narrative state artifacts MUST NOT mutate canonical world artifacts.

Portal usage may emit proposals only. Canonical acceptance remains outside this layer.
