# Wave30 Evidence Bundle + Surface Proof

Date: 2026-03-05
Repo: /home/main/devops/metaverse-kit

Canonical surface invariants:

- `ring_size=240`
- `chord(k)={(p0+k*d) mod 240,(p0-k*d) mod 240}`
- `seed_digest == wave30.evidence_bundle.v0.digest`

Commands:

```bash
npm run -s check:wave30-doc-freeze
npm run -s wave30:golden
npm run -s wave30:must-reject
npm run -s check:wave30-frames-contract
npm run -s check:wave30-emitter-contract
npm run -s check:wave30-uart-contract
npm run -s check:wave30-uart-decode-contract
npm run -s check:wave30-contract
```

Output highlights:

```txt
ok wave30 doc freeze guard
ok wave30 golden
ok wave30 must-reject
ok wave30 frames contract guard
ok wave30 emitter contract guard
ok wave30 uart contract guard
ok wave30 uart decode contract guard
ok wave30 contract guard
```
