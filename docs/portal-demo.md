# Demo Portal Runbook

## 1) Build demo bundle

```bash
npm run mv-pack-demo -- \
  --story ../Shape\ Signature/golden/story_bundle/mini.story_bundle.json \
  --world ../Shape\ Signature/golden/civic_world_graph/mini.civic_world_graph.json \
  --events ../Shape\ Signature/golden/civic_event_log/mini.civic_event_log.ndjson \
  --multiview ../Shape\ Signature/golden/multiview_manifest/mini.multiview_manifest.json \
  --harmonic ../Shape\ Signature/golden/wave15_harmonic/mini.harmonic.ndjson \
  --observer-profile ../Shape\ Signature/golden/wave15_harmonic/observer_profile_default.v0.json \
  --out /tmp/metaverse-demo.bundle \
  --include-portal --force
```

## 2) Verify bundle (fail closed)

```bash
npm run mv-verify-demo -- --bundle /tmp/metaverse-demo.bundle
```

## 3) Open portal

```bash
cd /tmp/metaverse-demo.bundle
python3 -m http.server 8787
# open http://localhost:8787/portal/index.html
```

Portal behavior:

- verifies integrity before render
- renders harmonic + civic + narrative panes
- allows advisory proposal export only
