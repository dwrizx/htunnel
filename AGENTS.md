# Repository Guidelines

## Project Structure

- `index.ts` is the entrypoint that wires the CLI and starts the Hono web server.
- `src/` contains all runtime code:
  - `providers/` tunnel implementations (Pinggy, Cloudflare, ngrok, Localtunnel) that conform to `TunnelProvider`.
  - `routes/` Hono route modules: `web.ts` for the UI and `api.ts` for JSON endpoints.
  - `views/` small HTML layout/components for the web UI.
  - `utils/` helper modules for provider/CLI checks.
  - `tunnel-manager.ts` and `types.ts` hold core orchestration logic and shared types.
- Generated/output folders like `dist/` or `out/` are not used currently and are ignored if created.

## Build, Test, and Development Commands

- `bun install` installs dependencies.
- `bun run start` runs the server from `index.ts` (defaults to `PORT=4000`).
- `bun run dev` runs with Bun watch mode for hot reload during development.
- `bun run help` or `bun run index.ts --help` prints CLI usage.
- `bun run typecheck` runs `tsc --noEmit` under strict settings to catch type issues.

## Coding Style & Naming Conventions

- TypeScript, ESM (`"type": "module"`). Keep public APIs typed and avoid `any`.
- Indentation is 2 spaces; use semicolons and double quotes to match existing files.
- Filenames are kebab-case (e.g., `cloudflared-installer.ts`); folders are lowercase.
- Classes/types use PascalCase; functions/variables use camelCase.

## Testing Guidelines

- There is no automated test suite yet. If you add tests, prefer Bun’s built-in runner (`bun test`) and name files `*.test.ts` or `*.spec.ts`, colocated with code or under a new `tests/` folder.

## Commit & Pull Request Guidelines

- Use Conventional Commit-style messages as seen in history: `feat:`, `fix:`, `docs:`, `chore:` + a short imperative summary.
- Pull requests should include a clear description, how to verify (commands and manual steps), and screenshots/GIFs for UI changes. Link related issues when applicable.

## Security & Configuration Tips

- `.env` is gitignored; never commit real provider tokens or credentials.
- When introducing new configuration, document it in `README.md` and consider adding a safe `.env.example`.
