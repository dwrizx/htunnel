# Repository Guidelines

## Project Structure

- `index.ts` is the entrypoint that wires CLI parsing and starts the Hono web server.
- `src/` contains runtime code:
  - `providers/`: tunnel provider implementations conforming to `TunnelProvider`
  - `routes/`: Hono route handlers (`web.ts`, `api.ts`)
  - `views/`: HTML layout/components rendered by the server
  - `utils/`: OS/CLI/install helpers
  - `tunnel-manager.ts`: tunnel lifecycle orchestration
  - `types.ts`: shared type definitions
- `docs/` contains provider-specific docs (Cloudflare currently).
- `skill/` contains local skill/reference documents.

## Build, Test, and Development Commands

- `bun install`: install dependencies
- `bun run start`: run production-style server (`PORT` default `4000`)
- `bun run dev`: watch mode for local development
- `bun run help` / `bun run index.ts --help`: print CLI help

Quality gates:

- `bun run typecheck`: run `tsgo -p tsconfig.json`
- `bun run lint`: run `oxlint .`
- `bun run lint:fix`: auto-fix lint issues where possible
- `bun run fmt`: run `oxfmt .`
- `bun run fmt:check`: formatting check only
- `bun run check:fast`: lint + formatting check
- `bun run check`: typecheck + lint + formatting check
- `bun run fix`: lint autofix + format

Agent expectation:

- Before claiming completion, run at minimum `bun run check`.

## Current Provider Behavior (Important)

### Pinggy

- Implementation uses official SDK package `@pinggy/pinggy`.
- Uses optional token from:
  - form `token`, or
  - env `PINGGY_TOKEN`.
- `PINGGY_PASSWORD` is deprecated in this repo and should not be reintroduced.
- For API/webhook traffic, Pinggy bypass header is:
  - `X-Pinggy-No-Screen: true`

### Cloudflare

- Requires `cloudflared` binary.
- Supports quick/local/token modes.
- Provider status and install endpoints are exposed in `api.ts`.

### ngrok

- Requires `ngrok` CLI.
- Token handling follows current UI/env behavior.

### Localtunnel

- Uses `localtunnel` package.
- Can expose password/IP hints in UI.

## Vite "Blocked request" Guidance

If user reports:

- `Blocked request. This host ("*.pinggy.link") is not allowed.`
- and app behind tunnel is Vite-based,

this is a Vite host allowlist issue, not a tunnel failure.

Recommend adding allowed hosts in target Vite app:

```ts
server: {
  allowedHosts: [".pinggy.link", ".pinggy.io"];
}
preview: {
  allowedHosts: [".pinggy.link", ".pinggy.io"];
}
```

If strict allowlisting is preferred, add exact active host.

## Coding Style & Naming Conventions

- TypeScript + ESM (`"type": "module"`)
- Keep public APIs strongly typed; avoid `any`
- Indentation: 2 spaces
- Use semicolons and double quotes
- Filenames: kebab-case
- Classes/types: PascalCase
- Functions/variables: camelCase

## Testing Guidelines

There is no full automated integration test suite yet.

When changing provider behavior, perform manual smoke checks:

1. Start a local HTTP server on test port (e.g. `3000`).
2. Start Hades Tunnel server.
3. Create tunnel via API/UI.
4. Verify URL appears and becomes reachable.
5. Stop tunnel and verify status/log transitions.

If adding tests, prefer Bun test runner:

- Name test files `*.test.ts` or `*.spec.ts`
- Place colocated or under `tests/`

## Commit & PR Guidelines

- Follow Conventional Commit style: `feat:`, `fix:`, `docs:`, `chore:`.
- PRs should include:
  - concise summary
  - verification commands + outcomes
  - screenshots/GIFs for UI changes
  - linked issue/task where relevant

## Security & Configuration Tips

- Never commit real credentials/tokens.
- `.env` is gitignored; keep it local.
- Document any new config/env behavior in `README.md`.
- Prefer least-privilege tokens.
