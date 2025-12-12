# Hades Tunnel - AI Coding Instructions

## Project Overview

A multi-provider tunnel manager with web UI built on **Bun + Hono + HTMX**. Supports Pinggy, Cloudflare, ngrok, and Localtunnel providers.

## Architecture

```
index.ts                    # Entrypoint: CLI parsing + Hono server startup
src/
  tunnel-manager.ts         # Singleton orchestrating all tunnel lifecycle (create/stop/restart)
  types.ts                  # Shared types: TunnelConfig, TunnelInstance, TunnelProvider
  providers/
    base.ts                 # TunnelProvider interface + waitForUrl() stream helper
    {pinggy,cloudflare,ngrok,localtunnel}.ts  # Provider implementations
    index.ts                # Provider registry: getProvider(name)
  routes/
    web.ts                  # Hono routes for HTML pages (/, /help, /install)
    api.ts                  # Hono routes for /api/* JSON + HTMX endpoints
  views/
    layout.ts               # HTML shell with Tailwind + HTMX setup
    components.ts           # UI components: tunnelCard, createForm, PROVIDERS metadata
  utils/
    cli-checker.ts          # Cross-platform CLI detection (cloudflared, ngrok)
    cloudflared-installer.ts # Auto-install helpers for cloudflared
```

### Key Data Flow

1. User submits form via HTMX → `POST /api/tunnels`
2. `apiRoutes` calls `tunnelManager.create(request)`
3. `TunnelManager` instantiates `TunnelInstance`, calls `provider.start(tunnel)`
4. Provider spawns subprocess via `Bun.spawn()`, parses stdout/stderr for URL
5. `tunnel.status` → "live" once URL extracted; UI polls `/api/tunnels` every 5s

## Development Commands

```bash
bun install                 # Install deps
bun run dev                 # Watch mode with hot reload
bun run start               # Production server (PORT=4000 default)
bun run typecheck           # tsc --noEmit (strict)
```

## Coding Conventions

- **TypeScript ESM** (`"type": "module"`). Keep types in `types.ts`; avoid `any`.
- **2-space indent**, semicolons, double quotes. Files are kebab-case; types PascalCase.
- **Providers** implement `TunnelProvider` interface from `base.ts`:
  ```ts
  interface TunnelProvider {
    name: string;
    start(tunnel: TunnelInstance): Promise<void>;
    stop(tunnel: TunnelInstance): Promise<void>;
  }
  ```
- **Subprocess patterns**: Use `Bun.spawn()` with `stdout: "pipe"`, parse streams with `waitForUrl()` helper or custom regex. Always handle timeout.
- **HTML rendering**: Return raw HTML strings from view functions. No JSX/templates—just tagged template literals with Tailwind classes.
- **HTMX integration**: Routes return HTML fragments; use `hx-get`, `hx-post`, `hx-trigger` attributes.

## Adding a New Provider

1. Create `src/providers/<name>.ts` implementing `TunnelProvider`
2. Register in `src/providers/index.ts` → `providers` object
3. Add metadata to `PROVIDERS` in `src/views/components.ts` (icon, color, features, requiresCli)
4. If CLI required, add detection in `cli-checker.ts`

## Environment Variables

```env
PORT=4000                      # Server port
CLOUDFLARE_TUNNEL_TOKEN=...    # For named Cloudflare tunnels
NGROK_AUTHTOKEN=...            # ngrok auth
PINGGY_TOKEN=... / PINGGY_PASSWORD=...  # Pinggy Pro
```

## Common Patterns

- **Stream parsing** for tunnel URLs: See `waitForCloudflareUrl()` in `cloudflare.ts` or `waitForUrls()` in `pinggy.ts`.
- **Cross-platform CLI checks**: `detectOS()` and `checkCliInstalled()` in `cli-checker.ts` handle Windows/macOS/Linux.
- **Graceful shutdown**: `process.on("SIGINT")` → `tunnelManager.stopAll()` kills all child processes.

## Testing

No test suite yet. If adding tests, use Bun's built-in runner (`bun test`) with `*.test.ts` files.
