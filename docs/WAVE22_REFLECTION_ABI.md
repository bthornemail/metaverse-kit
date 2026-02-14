# Wave 22 Reflection ABI

Wave 22 defines deterministic, involutive transforms over `wave19.world_graph.v0`.

## Model

- `wave22.reflection_result.v0`
- authority class: `advisory`

## Reflection operators (finite)

- `swap_endpoints`
- `swap_solon_solomon`
- `swap_asabiyyah_metatron`

All operators are involutive:

- `rho(rho(W)) = W`

## `wave22.reflection_result.v0` keyset

- `v`
- `authority`
- `source_digest`
- `reflection_operator_id`
- `result_digest`
- `operator_set_digest`
- `proof_of_involution`
- `digest`

### Rules

- `v == "wave22.reflection_result.v0"`
- `authority == "advisory"`
- all digest fields are `sha256:<64 lowercase hex>`
- `proof_of_involution == "1"`
- `operator_set_digest` must match the canonical operator list
- result digest must equal reflected world graph digest produced by the operator

## Tool

- `mv-reflect apply`
- `mv-reflect emit`
- `mv-reflect validate`

## Must-reject examples

- unknown operator id
- non-string membrane violations
- digest mismatch
- operator set digest mismatch
- involution proof not equal to `"1"`
