# Docker Release Envelope

Docker is a convenience transport envelope for running the static portal viewer.

Canonical truth remains the release tarball payload:

- `demo.bundle/`
- `portal/`
- `checksums.txt`
- `RELEASE_NOTES.md`

## Build sequence

1. Build canonical release payload:

```bash
npm run release:pack
npm run release:verify
```

2. Build Docker image envelope:

```bash
npm run release:docker
```

3. Optional smoke check:

```bash
npm run release:docker-smoke
```

## Run

```bash
docker run -p 8080:80 --read-only metaverse-kit:v0.1
```

Open:

- `http://localhost:8080/demo.bundle/portal/index.html`

## Policy

- Docker image is not an authority layer.
- No canonical mutation path is introduced in container runtime.
- Verification discipline remains mandatory.
