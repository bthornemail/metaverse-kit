# mv-proposal-bundle

Builds and validates proposal-only portal artifacts.

This tool does not mutate canonical world artifacts.

## Model

- `wave16.proposal_bundle.v0`

## Emit

```bash
mv-proposal-bundle emit \
  --base-bundle-digest sha256:<...> \
  --author portal:local \
  --actions ./actions.json \
  --out ./proposal_bundle.json
```

`actions.json` format:

```json
[
  {
    "kind": "annotate_node",
    "target": "sha256:<node_id>",
    "payload": {
      "source": "portal",
      "tag": "selected",
      "value": "1"
    }
  }
]
```

## Validate

```bash
mv-proposal-bundle validate --proposal ./proposal_bundle.json
```

## Invariants

- proposal is bound to one `base_bundle_digest`
- actions are declarative intent only
- digest is content-addressed canonical JSON
- authority remains advisory
