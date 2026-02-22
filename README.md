# Hades Tunnel

Multi-provider tunnel manager with a web UI built on Bun + Hono.

Supported providers:

- Pinggy
- Cloudflare Tunnel
- ngrok
- Localtunnel

## What This Project Solves

Hades Tunnel gives you one dashboard to:

- create public tunnels to local apps,
- inspect logs and connection status,
- stop/restart/delete tunnels,
- check provider readiness and installation status.

## Platform Support

- Windows
- macOS
- Linux

## Tech Stack

- Runtime: Bun
- Web framework: Hono
- UI: server-rendered HTML + HTMX + Tailwind CDN
- Tunnel providers: Pinggy SDK + provider CLIs/libraries

## Project Structure

- `index.ts`: app entrypoint and server bootstrap
- `src/tunnel-manager.ts`: lifecycle orchestration for all tunnels
- `src/providers/`: provider implementations
  - `pinggy.ts`
  - `cloudflare.ts`
  - `ngrok.ts`
  - `localtunnel.ts`
- `src/routes/`: Hono routes
  - `web.ts`: dashboard/help/install pages
  - `api.ts`: HTMX/API endpoints
- `src/views/`: HTML component/layout builders
- `src/utils/`: OS/CLI/install helpers
- `docs/CLOUDFLARE.md`: Cloudflare-specific guide
- `AGENTS.md`: contributor/agent workflow rules

## Prerequisites

- Bun installed (`bun --version`)
- Git
- Optional CLIs depending on provider:
  - `cloudflared` for Cloudflare provider
  - `ngrok` for ngrok provider
- Node.js is required indirectly for Localtunnel usage in some environments

## Installation

```bash
bun install
```

## Run

```bash
# default PORT=4000
bun run start

# dev mode (watch)
bun run dev

# new React frontend (Bun + Vite)
bun run dev:web

# help
bun run help
# or
bun run index.ts --help
```

Open:

- Dashboard: `http://localhost:4000`
- Help: `http://localhost:4000/help`
- Install page: `http://localhost:4000/install`
- React frontend: `http://localhost:5173`

## Environment Variables

```env
# Server
PORT=4000

# Cloudflare (optional, depending on mode)
CLOUDFLARE_TUNNEL_TOKEN=your_cloudflare_tunnel_token

# ngrok (optional but commonly needed for full usage)
NGROK_AUTHTOKEN=your_ngrok_authtoken

# Pinggy (optional, used for authenticated/persistent workflows)
PINGGY_TOKEN=your_pinggy_token
```

Notes:

- `PINGGY_PASSWORD` is no longer used by this project.
- Pinggy provider now uses the official SDK package: `@pinggy/pinggy`.

## Quality Gates (Fast Tooling)

This repository uses Bun-first quality tooling:

- Typecheck: `tsgo` (`@typescript/native-preview`)
- Lint: `oxlint`
- Format: `oxfmt`

Available scripts:

```bash
bun run typecheck
bun run lint
bun run lint:fix
bun run fmt
bun run fmt:check
bun run check:fast
bun run check
bun run fix
```

Recommended flow:

- During development: `bun run check:fast`
- Before commit/PR: `bun run check`
- To auto-fix style/lint issues: `bun run fix`

Frontend checks/build:

```bash
bun run --cwd frontend check
bun run --cwd frontend build
```

## New Frontend Stack (BunJS)

The repo now includes a Bun-powered React frontend in `frontend/` with:

- Vite `8.0.0-beta.15`
- React `19.2.4` with React Compiler enabled (`babel-plugin-react-compiler`)
- React Router `7.x`
- Tailwind CSS `4.x` via `@tailwindcss/vite`
- Zod `4.x` for runtime form validation
- fbtee `1.7.x` for i18n (`@nkzw/babel-preset-fbtee`)

Notes:

- Vite 8 here is beta.
- Existing Hono server-rendered UI stays available at `http://localhost:4000`.

## Provider Matrix

| Provider    | Requirements           | Auth                            | Notes                                     |
| ----------- | ---------------------- | ------------------------------- | ----------------------------------------- |
| Pinggy      | none (SDK-based)       | optional token                  | Supports bypass header for warning screen |
| Cloudflare  | `cloudflared` CLI      | optional token (mode dependent) | Supports quick/local/token modes          |
| ngrok       | `ngrok` CLI            | typically authtoken             | Includes inspector support                |
| Localtunnel | localtunnel dependency | none                            | Can use custom subdomain                  |

## Pinggy: Bypass Header and Vite Blocked Host

### 1) Pinggy warning page bypass

For API/webhook traffic through Pinggy, use this header:

```http
X-Pinggy-No-Screen: true
```

Examples:

```bash
curl -H "X-Pinggy-No-Screen: true" https://your-subdomain.a.free.pinggy.link
```

```ts
fetch("https://your-subdomain.a.free.pinggy.link", {
  headers: { "X-Pinggy-No-Screen": "true" },
});
```

### 2) Why Vite shows "Blocked request. This host is not allowed"

If your local app is Vite-based, this error is from Vite host protection, not from Pinggy.

Typical message:

```text
Blocked request. This host ("xxxx.a.free.pinggy.link") is not allowed.
```

Fix by allowing tunnel hosts in `vite.config.ts` (or `vite.config.js`):

```ts
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    allowedHosts: [".pinggy.link", ".pinggy.io"],
  },
  preview: {
    allowedHosts: [".pinggy.link", ".pinggy.io"],
  },
});
```

If you want strict allowlisting, include the exact hostname too:

```ts
server: {
  allowedHosts: ["nauzo-180-248-19-61.a.free.pinggy.link"];
}
preview: {
  allowedHosts: ["nauzo-180-248-19-61.a.free.pinggy.link"];
}
```

## Cloudflare Installation Quick Reference

See full guide: `docs/CLOUDFLARE.md`

Common install commands:

```bash
# macOS
brew install cloudflared

# Debian/Ubuntu
sudo apt-get update && sudo apt-get install cloudflared

# Windows (PowerShell)
winget install --id Cloudflare.cloudflared
```

## ngrok Installation Quick Reference

```bash
# macOS
brew install ngrok/ngrok/ngrok

# Debian/Ubuntu
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null

echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list

sudo apt update && sudo apt install ngrok

# then
ngrok config add-authtoken YOUR_AUTHTOKEN
```

## API Endpoints (High-Level)

- `GET /api/tunnels`: render tunnel list HTML
- `POST /api/tunnels`: create tunnel
- `POST /api/tunnels/:id/stop`: stop tunnel
- `POST /api/tunnels/:id/restart`: restart tunnel
- `DELETE /api/tunnels/:id`: delete tunnel
- `GET /api/tunnels/:id/logs`: logs HTML
- `GET /api/providers/status`: provider readiness
- `GET /api/stats`: tunnel stats
- `GET /api/system`: host/platform metadata

Cloudflare-focused:

- `GET /api/cloudflared/status`
- `POST /api/cloudflared/install`
- `GET /api/cloudflared/instructions`

## Verification Checklist (Manual)

1. Run quality gates:
   - `bun run check`
2. Start app:
   - `bun run start`
3. Create one tunnel per provider from the dashboard.
4. Confirm tunnel status becomes `Live`.
5. Open generated public URL and confirm it reaches your local app.
6. Stop and restart the tunnel from UI.
7. Confirm logs update correctly.

## Troubleshooting

### Pinggy tunnel creates but browser/API fails

- Ensure target local app is running on the configured port.
- Add `X-Pinggy-No-Screen: true` for non-browser traffic.
- If using Vite, configure `allowedHosts` (see section above).

### Cloudflare quick URL resolves intermittently right after creation

- Wait a few seconds and retry. DNS/edge propagation can be brief.

### ngrok tunnel up but upstream returns errors

- Verify your local service is healthy on configured host/port.

### Provider not ready

- Open `/install` page and use install instructions.
- Re-check `/api/providers/status`.

## Security Notes

- `.env` is gitignored; do not commit real tokens.
- Use least-privilege tokens where possible.
- Treat tunnel URLs as public endpoints.

## Contributing

- Use Conventional Commit style (`feat:`, `fix:`, `docs:`, `chore:`).
- Run `bun run check` before opening a PR.
- Include verification steps and screenshots for UI changes.
