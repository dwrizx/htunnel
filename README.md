# Hades Tunnel

Multi-provider tunnel manager dengan web UI. Support Pinggy, Cloudflare Tunnel, ngrok, dan Localtunnel.

## Quick Start

```bash
# Install dependencies
bun install

# Start server
bun run start

# Buka http://localhost:4000
```

## Usage

### Web UI

1. Buka `http://localhost:4000`
2. Pilih provider (Pinggy, Cloudflare, ngrok, Localtunnel)
3. Masukkan nama tunnel dan port lokal
4. Klik "Create Tunnel"
5. Copy URL publik yang muncul

### CLI

```bash
# Start server
bun run start

# Development mode (hot reload)
bun run dev

# Custom port
PORT=8080 bun run start
bun run index.ts --port 8080

# Show help
bun run help
bun run index.ts --help
```

## Providers

| Provider | Requirements | Notes |
|----------|-------------|-------|
| **Pinggy** | SSH | Gratis, tanpa instalasi |
| **Cloudflare** | `cloudflared` CLI | Install: `brew install cloudflared` |
| **ngrok** | `ngrok` CLI | Install: `brew install ngrok` |
| **Localtunnel** | npx | Gratis, support custom subdomain |

## Install Provider CLIs

### Cloudflare Tunnel

```bash
# macOS
brew install cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

### ngrok

```bash
# macOS
brew install ngrok

# Linux
snap install ngrok
```

## Project Structure

```
hadestunnel/
├── index.ts              # Entry point
├── src/
│   ├── types.ts          # TypeScript types
│   ├── cli.ts            # CLI parser & help
│   ├── tunnel-manager.ts # Tunnel management
│   ├── providers/        # Provider implementations
│   │   ├── base.ts
│   │   ├── pinggy.ts
│   │   ├── cloudflare.ts
│   │   ├── ngrok.ts
│   │   ├── localtunnel.ts
│   │   └── index.ts
│   ├── routes/           # HTTP routes
│   │   ├── web.ts
│   │   └── api.ts
│   └── views/            # HTML templates
│       ├── layout.ts
│       └── components.ts
├── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Web dashboard |
| GET | `/help` | Help page |
| GET | `/api/tunnels` | List all tunnels |
| POST | `/api/tunnels` | Create tunnel |
| POST | `/api/tunnels/:id/stop` | Stop tunnel |
| DELETE | `/api/tunnels/:id` | Delete tunnel |
| GET | `/api/stats` | Get statistics |

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Frontend**: HTMX + Tailwind CSS
- **Tunneling**: SSH (Pinggy), CLI spawning (others)
# hadestunnel
