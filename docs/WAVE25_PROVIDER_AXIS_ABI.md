# Wave 25 Provider Axis ABI

Wave 25 tracks extension pressure from providers as advisory telemetry.

## Model

- `wave25.provider_extension.v0`
- authority class: `advisory`

## Keyset

- `v`
- `authority`
- `canonical_world_digest`
- `provider_id`
- `extension_scope`
- `projection_delta_size`
- `extension_artifact_count`
- `behavior_extension_count`
- `magnitude_m`
- `extension_digest`
- `digest`

## Rules

- telemetry-only layer; does not mutate canonical world artifacts
- `magnitude_m` is deterministic and recomputed from extension counts
- no reject threshold on magnitude value; only schema and digest validation

## Scope enum

- `renderer`
- `adapter`
- `projection`
- `tooling`
- `hybrid`
