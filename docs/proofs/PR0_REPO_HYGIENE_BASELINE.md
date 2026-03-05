# PR-0 Repo Hygiene Baseline

Date: 2026-03-05

Scope: isolate wave protocol lanes from unrelated workspace churn.

Excluded from wave PR slices:

- `/home/main/devops/artifacts/*` runtime outputs
- `/home/main/devops/psync/led-sphere/*` delete set
- `/home/main/devops/holosphere/*` separate stream
- `/home/main/devops/poly-logos/*` separate stream

Result:

- Wave protocol/tooling/UI slices are contained to `metaverse-kit` plus `scripts/closure-spine-smoke.sh` for final spine labeling.
