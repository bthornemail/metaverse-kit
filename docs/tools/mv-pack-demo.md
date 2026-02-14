# mv-pack-demo

Builds a deterministic, projection-only demo bundle for the portal viewer.

The tool copies canonical artifacts, emits a content-addressed manifest, and writes an integrity lock.

It does not mutate authoritative state.

## Usage

```bash
mv-pack-demo \
  --story ./path/story_bundle.json \
  --world ./path/civic_world_graph.json \
  --events ./path/civic_event_log.ndjson \
  --multiview ./path/multiview_manifest.json \
  --harmonic ./path/harmonic.ndjson \
  --observer-profile ./path/observer_profile.json \
  --world-entities ./path/world_entities.json \
  --world-graph ./path/world_graph.json \
  --behavior-grammar ./path/behavior_grammar.json \
  --entity-model ./path/entity.v0.json \
  --out ./demo.bundle
```

Optional flags:

- `--include-portal`: copy static portal viewer files into `demo.bundle/portal/`
- `--force`: overwrite existing output directory
- `--world-entities`: include `wave19.world_entities.v0` artifact
- `--world-graph`: include `wave19.world_graph.v0` artifact
- `--behavior-grammar`: include `wave20.behavior_grammar.v0` artifact
- `--entity-model`: include one or more `wave19.entity_model.v0` artifacts

## Output

```text
demo.bundle/
  canonical/
    story_bundle.json
    civic_world_graph.json
    civic_event_log.ndjson
    multiview_manifest.json
    harmonic.ndjson
    observer_profile.json
    world_entities.json (optional)
    world_graph.json (optional)
    behavior_grammar.json (optional)
    entity_model_00.json (optional)
  manifest.json
  integrity.sha256
  portal/ (optional)
```

`manifest.json` is canonicalized and hash-locked via `integrity.sha256`.

Any consumer must verify integrity before rendering.
