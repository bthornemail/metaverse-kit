# mv-merge-review-render

Deterministically render `wave17.merge_review.v0` artifacts into reviewer-facing summaries.

## Render

```bash
npm run -s mv-merge-review-render -- render \
  --in dev-docs/wave17/merge-review.v0.json \
  --evidence dev-docs/wave28/signal-poly-projection.v0.json \
  --evidence dev-docs/wave28/poly-decomp.v0.json \
  --evidence dev-docs/wave27/pointer-sync.residual.fail.v0.json \
  --out-md dev-docs/wave17/merge-review.summary.v0.golden.md \
  --out-json dev-docs/wave17/merge-review.summary.v0.golden.json \
  --format both \
  --strict
```

## Output contracts

- Markdown: `merge-review.summary.v0.md`
- JSON: `wave17.merge_review_summary.v0`

Both outputs are deterministic and advisory-only.
Evidence entries are normalized and sorted by `(v,digest)` before rendering.

Supported evidence artifacts (repeatable `--evidence`):

- `wave28.signal_poly_projection.v0`
- `wave28.poly_decomp.v0`
- `wave27.pointer_sync_residual.v0`

Summary JSON includes `evidence[]` and `evidence_digest` (`sha256` of canonical `evidence[]` array).
