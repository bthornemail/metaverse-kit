# Demo Portal Composition Plan

## Minimal component graph

```text
Canonical artifacts (Wave14/15)
  -> mv-pack-demo
  -> demo.bundle (manifest + integrity + canonical files)
  -> mv-verify-demo / portal verify.js
  -> portal runtime.js
  -> render.js panes (harmonic + civic graph + narrative)
  -> mv-proposal-bundle (proposal export/validation)
```

## Reused components

- Existing canonical artifacts from Wave 14/15
- Existing metaverse-kit tools and portal scaffold
- Existing deterministic hashing/content-address model

## Glue code only

- deterministic bundle packager (`mv-pack-demo`)
- fail-closed verifier (`mv-verify-demo`)
- read-only portal runtime wiring
- proposal-only artifact export (`wave16.proposal_bundle.v0`)

## Components intentionally untouched

- Authority doctrine layers
- Server/network authority paths
- Canonical artifact producers
- Any merge/acceptance authority path

## Safety constraints enforced

- Canonical artifacts remain read-only
- Portal verifies before render
- UI state never writes canonical state
- Proposal export binds to base bundle digest
