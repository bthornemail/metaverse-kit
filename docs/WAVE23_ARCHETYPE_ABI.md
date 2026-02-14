# Wave 23 Archetype ABI

Wave 23 defines deterministic world typing over `wave19.world_graph.v0`.

## Model

- `wave23.archetype_signature.v0`
- authority class: `advisory`

## `wave23.archetype_signature.v0` keyset

- `v`
- `authority`
- `world_graph_digest`
- `invariant_signature_hash`
- `structural_features`
- `archetype_id`
- `digest`

### Rules

- same canonical world graph digest must classify to the same `archetype_id`
- archetype set is finite and versioned
- classifier does not mutate world structure
- reflection (wave22 involutions) must preserve archetype class

## Finite archetype set

- `isolated`
- `dyadic`
- `civic_mesh`
- `institutional`
- `observer_web`

## Must-reject examples

- unknown archetype id
- digest mismatch
- world graph digest mismatch
- non-string membrane violations
