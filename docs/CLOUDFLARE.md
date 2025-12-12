# Cloudflare Tunnel Documentation

Complete guide for using Cloudflare Tunnel with HadesTunnel.

## Table of Contents

- [Overview](#overview)
- [Platform Compatibility](#platform-compatibility)
- [Installation](#installation)
- [Tunnel Modes](#tunnel-modes)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Overview

Cloudflare Tunnel provides secure, encrypted tunnels between your local services and the Cloudflare edge network. HadesTunnel supports three modes:

| Mode | Auth Required | URL Type | Use Case |
|------|--------------|----------|----------|
| **Quick** | No | Random (`*.trycloudflare.com`) | Development, testing |
| **Local** | Yes (login) | Custom domain | Production, persistent tunnels |
| **Token** | Yes (token) | Dashboard configured | Team/enterprise deployments |

---

## Platform Compatibility

### Supported Platforms

| Platform | Architecture | Status |
|----------|--------------|--------|
| **Windows** | x64, x86 | ✅ Full Support |
| **macOS** | Intel (x64), Apple Silicon (arm64) | ✅ Full Support |
| **Linux** | x64, arm64, arm | ✅ Full Support |

### Auto-Detection Features

HadesTunnel automatically detects:

1. **Operating System**: Windows, macOS, Linux
2. **CPU Architecture**: x64 (amd64), arm64, arm, x86 (386)
3. **Linux Distribution**: Debian/Ubuntu, RHEL/Fedora/CentOS, Arch Linux
4. **Package Manager**: apt, dnf, yum, pacman, winget, homebrew, chocolatey
5. **cloudflared Installation Status**: Checks if already installed

---

## Installation

### Automatic Installation

HadesTunnel can automatically install `cloudflared` for you:

1. Go to the web UI at `http://localhost:4000`
2. Select **Cloudflare** as provider
3. If not installed, click the **Install** button on the provider card
4. Wait for installation to complete

Or via API:

```bash
# Check status
curl http://localhost:4000/api/cloudflared/status

# Auto-install (skips if already installed)
curl -X POST http://localhost:4000/api/cloudflared/install

# Get installation instructions
curl http://localhost:4000/api/cloudflared/instructions
```

### Manual Installation

#### Windows

**Option 1: winget (Recommended)**
```powershell
winget install --id Cloudflare.cloudflared
```

**Option 2: Chocolatey**
```powershell
choco install cloudflared
```

**Option 3: Manual Download**
```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"

# Add to user PATH (optional)
$env:PATH += ";$(Get-Location)"
```

#### macOS

**Option 1: Homebrew (Recommended)**
```bash
brew install cloudflared
```

**Option 2: Binary Download**
```bash
# Intel Mac
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz | tar xz
sudo mv cloudflared /usr/local/bin/

# Apple Silicon (M1/M2/M3)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz | tar xz
sudo mv cloudflared /usr/local/bin/
```

#### Linux

**Debian/Ubuntu (APT)**
```bash
# Add repository
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | \
  sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list

# Install
sudo apt-get update && sudo apt-get install cloudflared
```

**RHEL/CentOS/Fedora (DNF/YUM)**
```bash
# Add repository
curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | \
  sudo tee /etc/yum.repos.d/cloudflared.repo

# Install (Fedora/RHEL 8+)
sudo dnf install cloudflared

# Install (CentOS 7/RHEL 7)
sudo yum install cloudflared
```

**Arch Linux**
```bash
sudo pacman -S cloudflared
```

**Binary (Any Linux)**
```bash
# x64
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared

# ARM64
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared

# Make executable and install
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

### Verify Installation

```bash
cloudflared --version
# Output: cloudflared version 2024.x.x (built YYYY-MM-DD)
```

---

## Tunnel Modes

### 1. Quick Tunnel Mode

**The easiest way to get started.** Creates an instant temporary tunnel with a random URL.

**Features:**
- ✅ No authentication required
- ✅ No setup needed
- ✅ Instant URL generation
- ⚠️ URL changes on every restart
- ⚠️ Not suitable for production

**Usage:**
1. Select Cloudflare provider
2. Choose **Quick** mode
3. Enter tunnel name and port
4. Click Create

**Behind the scenes:**
```bash
cloudflared tunnel --url http://localhost:3000
```

**Output URL format:** `https://random-words.trycloudflare.com`

---

### 2. Local Tunnel Mode

**For persistent tunnels with your own domain.** Uses locally-stored credentials.

**Features:**
- ✅ Persistent tunnel name
- ✅ Use your own domain
- ✅ Credentials stored locally (`~/.cloudflared/`)
- ✅ Auto-creates DNS routes
- ⚠️ Requires Cloudflare account
- ⚠️ Domain must be on Cloudflare DNS

**Prerequisites:**
1. Cloudflare account
2. Domain added to Cloudflare
3. Domain nameservers pointing to Cloudflare

**First-time Setup:**
1. Select Cloudflare provider
2. Choose **Local** mode
3. Enter tunnel name (e.g., `my-app`)
4. Optionally enter domain (e.g., `app.yourdomain.com`)
5. Click Create
6. **Browser will open** - log in to Cloudflare and authorize

**Behind the scenes:**
```bash
# First time: authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create my-app

# Configure DNS route
cloudflared tunnel route dns my-app app.yourdomain.com

# Run tunnel
cloudflared tunnel run my-app
```

**Credentials location:**
- **Linux/macOS:** `~/.cloudflared/`
- **Windows:** `%USERPROFILE%\.cloudflared\`

---

### 3. Token Tunnel Mode

**For team/enterprise deployments.** Uses a pre-configured token from Cloudflare Dashboard.

**Features:**
- ✅ Managed via Cloudflare Dashboard
- ✅ Team-friendly (share tokens)
- ✅ No local credentials needed
- ✅ Centralized configuration
- ⚠️ URL configured in dashboard, not shown in HadesTunnel

**Getting a Token:**
1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Choose **Cloudflared** connector
5. Give it a name
6. Copy the token (starts with `eyJhIjo...`)

**Usage:**
1. Select Cloudflare provider
2. Choose **Token** mode
3. Paste your token
4. Click Create

**Behind the scenes:**
```bash
cloudflared tunnel run --token eyJhIjoiNzI0NGQ1NTg5NDdiZTJmY2Y5ZGJlMmY5NGNiNmY1ZDIi...
```

---

## API Reference

### Check Installation Status

```bash
GET /api/cloudflared/status
```

**Response:**
```json
{
  "installed": true,
  "version": "2024.11.1",
  "path": "/usr/local/bin/cloudflared",
  "instructions": {
    "platform": "linux",
    "arch": "amd64",
    "distro": "debian",
    "preferred": {
      "method": "APT",
      "command": "sudo apt-get install cloudflared",
      "description": "For Debian, Ubuntu..."
    }
  },
  "availableMethods": [
    { "name": "apt", "available": true, "command": "..." },
    { "name": "binary", "available": true, "command": "..." }
  ]
}
```

### Auto-Install

```bash
POST /api/cloudflared/install
```

**Response (already installed):**
```json
{
  "success": true,
  "message": "cloudflared 2024.11.1 is already installed",
  "version": "2024.11.1",
  "skipped": true
}
```

**Response (newly installed):**
```json
{
  "success": true,
  "message": "cloudflared 2024.11.1 installed successfully",
  "version": "2024.11.1"
}
```

### Get System Info

```bash
GET /api/system
```

**Response:**
```json
{
  "platform": "linux",
  "arch": "amd64",
  "distro": "debian",
  "packageManager": "apt",
  "nodeVersion": "v20.x.x",
  "bunVersion": "1.x.x"
}
```

---

## Troubleshooting

### Common Issues

#### "cloudflared not found"

**Windows:**
- Restart your terminal/PowerShell after installation
- Check if cloudflared.exe is in PATH: `where cloudflared`
- Try running from install directory

**macOS/Linux:**
- Check installation: `which cloudflared`
- Try: `export PATH=$PATH:/usr/local/bin`
- Verify permissions: `ls -la /usr/local/bin/cloudflared`

#### "Authentication failed" (Local Mode)

1. Delete old credentials:
   ```bash
   rm -rf ~/.cloudflared/cert.pem
   ```
2. Re-authenticate:
   ```bash
   cloudflared tunnel login
   ```

#### "Timeout waiting for tunnel URL"

- Check internet connection
- Verify cloudflared can reach Cloudflare:
  ```bash
  cloudflared tunnel --url http://localhost:3000
  ```
- Check firewall settings (allow outbound on port 7844)

#### "DNS route already exists"

This is usually safe to ignore. The tunnel will still work.

To manually manage routes:
```bash
# List routes
cloudflared tunnel route dns list

# Delete a route
cloudflared tunnel route dns delete <tunnel-id> <hostname>
```

### Debug Commands

```bash
# Check cloudflared version
cloudflared --version

# Test quick tunnel
cloudflared tunnel --url http://localhost:3000

# List all tunnels
cloudflared tunnel list

# Get tunnel info
cloudflared tunnel info <tunnel-name>

# Check authentication
ls -la ~/.cloudflared/cert.pem
```

---

## References

- [Official Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Create Local Tunnel Guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)
- [cloudflared Downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/)
- [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
