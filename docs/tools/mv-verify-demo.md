# mv-verify-demo

Verifies a `demo.bundle` fail-closed before any rendering.

Checks:

- `integrity.sha256` matches `manifest.json` bytes
- every listed file exists
- every listed file digest matches
- every listed file byte count matches

## Usage

```bash
mv-verify-demo --bundle ./demo.bundle
```

This tool is projection-only and does not mutate canonical artifacts.
