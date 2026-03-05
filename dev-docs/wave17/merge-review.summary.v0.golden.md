# Merge Review Summary (wave17.merge_review.v0)

- authority: advisory
- bundle_digest: sha256:4c48b633fbd40e9f201fb081254f76e55c04bd0c6bdd2a1b5cc1351043f2da5c
- input_digest: sha256:d1743eac15ab611db0698ae21f1af81b77010882095ff8e5ac9f2958f76d431d
- status: conflict
- evidence_digest: sha256:cc1b33b96391fa0720dba9740e033fb73555edee8add7132e78b88cb3e539764

## Overview
- conflicts: 2
- rejected_components: 4
- changed_entities: 3
- changed_edges: 3

## Conflicts
| group_id | kind | left_digest | right_digest | resolution |
|---|---|---|---|---|
| edge:room-lamp | edge | sha256:d8996db4ccbc4ee9eab9a66c332612a324be9fe8dd7b07b9c3d82c6cfcf518b9 | sha256:6b7c3acd953326c41d2f2625a5f98690df10145aa3f0be543edb15b5036c8800 | manual |
| node:lamp | node | sha256:a8d5bc5078993fc5f25235b7d4cc19a89e021bb5613e1bd1e1995a88700b9fc3 | sha256:be30cd30cc4d4e459cdb847cb705d3c97dfcb26888cd577a22fd0e3d615e0bb0 | manual |

## Rejected Components
| group_id | reason | digest |
|---|---|---|
| edge:room-desk | right_only | sha256:32c4c71f8f41f784f3a1e22208f907552ddca60d5f352aed3a28f328d4096a31 |
| edge:room-door | left_only | sha256:f3b21993fd468206b075edfbb29a5d80b03bab434a1d4b0bdb4834e461da412f |
| node:desk | right_only | sha256:9e93b7eab9c436b2af020cf4cd5cbde7371d09fa9ced2b7b1282bf4c380e9b1c |
| node:door | left_only | sha256:4d745d25fc5867a511e2389059225f4975a70da535f4c212f6271bf24f33c49a |

## Evidence
| role | v | digest |
|---|---|---|
| pointer_residual | wave27.pointer_sync_residual.v0 | sha256:330a180c7c844115be380cf6346a5fb900c146c6a966e52d0992d206935002af |
| poly_decomp | wave28.poly_decomp.v0 | sha256:b4080594e251976ea489b77fe36eda0d9d91e94390699ae1a6a4a626be1ef654 |
| signal_poly_projection | wave28.signal_poly_projection.v0 | sha256:0cb933ff584402957c28ee6a2ce9b394ef4814c8ec37b5a70e9f0261b89ed2a5 |

## Footer
- evidence_digest: sha256:cc1b33b96391fa0720dba9740e033fb73555edee8add7132e78b88cb3e539764
- summary_digest: sha256:7e7dd4edafc0956dd25274c9746600b437ff4f55962fbb595d441fef9a4a0242
- generated_by: mv-merge-review-render

