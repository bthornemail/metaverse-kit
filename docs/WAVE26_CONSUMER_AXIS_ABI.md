# Wave 26 Consumer Axis ABI

Wave 26 tracks interaction pressure as advisory telemetry.

## Model

- `wave26.consumer_trace.v0`
- authority class: `advisory`

## Keyset

- `v`
- `authority`
- `world_digest`
- `provider_magnitude_m`
- `interaction_count`
- `max_projection_depth`
- `behavior_invocations`
- `invariant_axis_count`
- `q_value`
- `digest`

## Stability diagnostic

`q_value` is computed as:

- `q = ||Lambda||^2 - 2mn`
- `||Lambda|| = invariant_axis_count`
- `m = provider_magnitude_m`
- `n = interaction_count`

If `q < 0`, tool emits warning only. Validation still passes if schema and digest are valid.
