# Repository Guidelines

## Project Structure & Module Organization

- `apps/`: runnable applications (`apps/server` HTTP/WebSocket API, `apps/client` Vite React UI, MCP client/server)
- `packages/`: core libraries (protocol, tilestore, shadow-canvas, discovery, etc.)
- `tools/`: CLI utilities (`mv-init`, `mv-host`, `mv-client`, `mv-replay`, `mv-ext32`)
- `world-format/`: scope and invariants dotfiles (`.ulp-root`, `.ulp-scope`, `.ulp-ignore`)
- `docs/` and `dev-docs/`: product/architecture documentation
- `examples/`: demo worlds and sample data

## Build, Test, and Development Commands

- `npm install`: install workspace dependencies
- `npm run build`: build all workspaces
- `npm run typecheck`: TypeScript project build across the repo
- `npm run dev:server`: run the server with watch mode
- `npm run dev:client`: run the Vite client locally
- `npm run mv-init -- --world world --space demo`: create a world
- `npm run mv-host -- --world world`: run the host/server against a world
- `npm run mv-client`: open the client shell

## Coding Style & Naming Conventions

- TypeScript + ESM across apps/packages; match existing style in the file you edit.
- Indentation is 2 spaces; strings commonly use double quotes.
- React components use `PascalCase`, variables/functions use `camelCase`.
- Keep package and tool directories in `kebab-case` (e.g., `shadow-canvas`).
- Use `npm run typecheck` before submitting changes that touch TS types.

## Testing Guidelines

- `npm run test` runs workspace tests that define a `test` script.
- There is no repo-wide test runner today; add package-level tests as needed.
- Manual test script exists at `packages/atomic-state-tree/test_basic.sh`.

## Commit & Pull Request Guidelines

- Commit messages follow a conventional style: `feat: ...` or `feat(scope): ...`.
- Keep subjects short and imperative; include a scope when it clarifies intent.
- PRs should include: a concise summary, testing notes, and linked issues.
- Include screenshots or short clips for UI changes in `apps/client`.

## Configuration Notes

- Server defaults: `PORT=8080`, `WORLD=./world`, `PEER_ID=peer:local`.
- Scope rules live in `world-format/` dotfiles; update them alongside protocol changes.
