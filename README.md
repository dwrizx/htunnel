# Hades Tunnel

Multi-provider tunnel manager dengan web UI. Support Pinggy, Cloudflare Tunnel, ngrok, dan Localtunnel.

**Compatible with Windows, macOS, and Linux.**

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
| **Cloudflare** | `cloudflared` CLI | Enterprise-grade tunneling |
| **ngrok** | `ngrok` CLI | Web inspector dashboard |
| **Localtunnel** | npx | Gratis, support custom subdomain |

## Environment Variables

```env
# Server port (default: 4000)
PORT=4000

# Cloudflare Tunnel token (optional, for named tunnels)
CLOUDFLARE_TUNNEL_TOKEN=your_tunnel_token

# ngrok authentication token
NGROK_AUTHTOKEN=your_ngrok_token

# Pinggy Pro credentials (optional)
PINGGY_TOKEN=your_pinggy_token
PINGGY_PASSWORD=your_pinggy_password
```

---

## Install Provider CLIs

### Cloudflare Tunnel (`cloudflared`)

Based on [official Cloudflare documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/).

#### Windows

**Option 1: winget (recommended)**
```powershell
winget install --id Cloudflare.cloudflared
```

**Option 2: Chocolatey**
```powershell
choco install cloudflared
```

**Option 3: Manual Download**
1. Download from: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/
2. Rename to `cloudflared.exe`
3. Add to PATH or run from download directory

#### macOS

```bash
brew install cloudflared
```

Or download directly from [releases page](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/).

#### Linux - Debian/Ubuntu (APT)

```bash
# Add Cloudflare's package signing key
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | \
  sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null

# Add Cloudflare's apt repo
echo "deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list

# Install cloudflared
sudo apt-get update && sudo apt-get install cloudflared
```

#### Linux - RHEL/CentOS/Fedora (RPM)

```bash
# Add Cloudflare's repository
curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | \
  sudo tee /etc/yum.repos.d/cloudflared.repo

# Install cloudflared
sudo yum update && sudo yum install cloudflared
```

#### Linux - Arch

```bash
pacman -Syu cloudflared
```

#### Linux - Binary (Universal)

```bash
# Download binary
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared

# Make executable and move to PATH
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

For ARM architectures, replace `amd64` with `arm64` or `arm`.

#### Build from Source

```bash
git clone https://github.com/cloudflare/cloudflared.git
cd cloudflared
make cloudflared
go install github.com/cloudflare/cloudflared/cmd/cloudflared
```

---

### ngrok

#### Windows

```powershell
# Chocolatey
choco install ngrok

# Or download manually from https://ngrok.com/download
```

#### macOS

```bash
brew install ngrok/ngrok/ngrok
```

#### Linux - Debian/Ubuntu (APT)

```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null

echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list

sudo apt update && sudo apt install ngrok
```

#### Linux - Snap

```bash
snap install ngrok
```

#### After Installation

Get your authtoken from [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken):

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```

---

### Pinggy

**No installation required!** Uses SSH which is already installed on most systems.

- **Free tier**: Works instantly
- **Pro tier**: Get credentials from [dashboard.pinggy.io](https://dashboard.pinggy.io)

---

### Localtunnel

**No installation required!** Uses npx (comes with Node.js).

Make sure Node.js is installed:

```bash
# Windows
winget install OpenJS.NodeJS

# macOS
brew install node

# Linux (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
```

---

## Cloudflare Tunnel Modes

### Quick Tunnel (Default)

- No authentication required
- Random URL on `.trycloudflare.com`
- Perfect for development/testing
- URL changes on restart

```bash
# How it works internally
cloudflared tunnel --url http://localhost:3000
```

### Named Tunnel (Advanced)

For persistent tunnels with custom domains:

1. **Login to Cloudflare**
   ```bash
   cloudflared tunnel login
   ```

2. **Create a tunnel**
   ```bash
   cloudflared tunnel create my-tunnel
   ```

3. **Configure the tunnel** (create `~/.cloudflared/config.yml`)
   ```yaml
   url: http://localhost:3000
   tunnel: <Tunnel-UUID>
   credentials-file: /home/user/.cloudflared/<Tunnel-UUID>.json
   ```

4. **Route DNS**
   ```bash
   cloudflared tunnel route dns <UUID or NAME> <hostname>
   ```

5. **Run the tunnel**
   ```bash
   cloudflared tunnel run <UUID or NAME>
   ```

See [Cloudflare documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/) for more details.

---

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
│   ├── utils/            # Utility functions
│   │   ├── cli-checker.ts
│   │   └── cloudflared-installer.ts
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
| GET | `/install` | Provider installation page |
| GET | `/api/tunnels` | List all tunnels |
| POST | `/api/tunnels` | Create tunnel |
| POST | `/api/tunnels/:id/stop` | Stop tunnel |
| POST | `/api/tunnels/:id/restart` | Restart tunnel |
| DELETE | `/api/tunnels/:id` | Delete tunnel |
| GET | `/api/tunnels/:id/logs` | Get tunnel logs |
| GET | `/api/stats` | Get statistics |
| GET | `/api/system` | Get system info |
| GET | `/api/providers/status` | Check provider status |
| POST | `/api/install/:provider` | Auto-install provider |
| GET | `/api/cloudflared/status` | Cloudflared status |
| POST | `/api/cloudflared/install` | Auto-install cloudflared |

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Frontend**: HTMX + Tailwind CSS
- **Tunneling**: SSH (Pinggy), CLI spawning (others)

## License

MIT
