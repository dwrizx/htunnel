const HELP = `
╔═══════════════════════════════════════════════════════════╗
║  Hades Tunnel - Multi-provider Tunnel Manager             ║
╚═══════════════════════════════════════════════════════════╝

USAGE:
  bun run start           Start the web server
  bun run dev             Start with hot reload
  bun run index.ts --help Show this help message

OPTIONS:
  --help, -h              Show this help message
  --port, -p <port>       Set server port (default: 4000)

ENVIRONMENT:
  PORT                    Server port (default: 4000)
  CLOUDFLARE_TUNNEL_TOKEN Cloudflare tunnel token (for named tunnels)
  NGROK_AUTHTOKEN         ngrok authentication token
  PINGGY_TOKEN            Pinggy Pro token

PROVIDERS:
  • Pinggy       Free SSH tunneling, no installation needed
  • Cloudflare   Requires 'cloudflared' CLI installed
  • ngrok        Requires 'ngrok' CLI installed  
  • Localtunnel  Uses npx, supports custom subdomains

EXAMPLES:
  # Start on default port 4000
  bun run start

  # Start on custom port
  PORT=8080 bun run start
  bun run index.ts --port 8080

  # Development mode
  bun run dev

═══════════════════════════════════════════════════════════════
                    INSTALLATION GUIDES
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  CLOUDFLARE TUNNEL (cloudflared)                            │
│  https://developers.cloudflare.com/cloudflare-one/          │
│  networks/connectors/cloudflare-tunnel/                     │
└─────────────────────────────────────────────────────────────┘

  ▶ Windows (winget - recommended)
    winget install --id Cloudflare.cloudflared

  ▶ Windows (Chocolatey)
    choco install cloudflared

  ▶ Windows (Manual)
    1. Download from: https://developers.cloudflare.com/cloudflare-one/
       networks/connectors/cloudflare-tunnel/downloads/
    2. Rename to cloudflared.exe
    3. Add to PATH or run from download directory

  ▶ macOS (Homebrew)
    brew install cloudflared

  ▶ Linux - Debian/Ubuntu (APT)
    # Add Cloudflare's package signing key
    sudo mkdir -p --mode=0755 /usr/share/keyrings
    curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | \\
      sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null

    # Add Cloudflare's apt repo
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] \\
      https://pkg.cloudflare.com/cloudflared any main" | \\
      sudo tee /etc/apt/sources.list.d/cloudflared.list

    # Install
    sudo apt-get update && sudo apt-get install cloudflared

  ▶ Linux - RHEL/CentOS/Fedora (RPM)
    curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | \\
      sudo tee /etc/yum.repos.d/cloudflared.repo
    sudo yum update && sudo yum install cloudflared

  ▶ Linux - Arch
    pacman -Syu cloudflared

  ▶ Linux - Binary (universal)
    curl -L https://github.com/cloudflare/cloudflared/releases/\\
      latest/download/cloudflared-linux-amd64 -o cloudflared
    chmod +x cloudflared
    sudo mv cloudflared /usr/local/bin/

  ▶ Build from source
    git clone https://github.com/cloudflare/cloudflared.git
    cd cloudflared
    make cloudflared
    go install github.com/cloudflare/cloudflared/cmd/cloudflared

┌─────────────────────────────────────────────────────────────┐
│  NGROK                                                      │
│  https://ngrok.com/docs/getting-started/                    │
└─────────────────────────────────────────────────────────────┘

  ▶ Windows (Chocolatey)
    choco install ngrok

  ▶ Windows (Manual)
    1. Download from: https://ngrok.com/download
    2. Extract and add to PATH

  ▶ macOS (Homebrew)
    brew install ngrok/ngrok/ngrok

  ▶ Linux - Debian/Ubuntu (APT)
    curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \\
      sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
    echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \\
      sudo tee /etc/apt/sources.list.d/ngrok.list
    sudo apt update && sudo apt install ngrok

  ▶ Linux - Snap
    snap install ngrok

  After installation, authenticate with:
    ngrok config add-authtoken YOUR_AUTHTOKEN

┌─────────────────────────────────────────────────────────────┐
│  PINGGY                                                     │
│  https://pinggy.io/docs/                                    │
└─────────────────────────────────────────────────────────────┘

  No installation required! Uses SSH (already installed on most systems).
  
  ▶ Free tier (no signup)
    Works instantly - just select Pinggy in the UI

  ▶ Pro tier (persistent URLs)
    1. Sign up at https://dashboard.pinggy.io
    2. Get your token
    3. Enter it in Hades Tunnel UI or set environment variable:
       PINGGY_TOKEN=your_token

┌─────────────────────────────────────────────────────────────┐
│  LOCALTUNNEL                                                │
│  https://github.com/localtunnel/localtunnel                 │
└─────────────────────────────────────────────────────────────┘

  No installation required! Uses npx (comes with Node.js).
  
  Just make sure Node.js/npm is installed:
  
  ▶ Windows
    winget install OpenJS.NodeJS

  ▶ macOS
    brew install node

  ▶ Linux
    # Using nvm (recommended)
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    nvm install node

═══════════════════════════════════════════════════════════════

WEB UI:
  Open http://localhost:4000 in your browser after starting the server.
  
  Navigate to /help for usage instructions.

`;

export function showHelp(): void {
  console.log(HELP);
}

export function parseArgs(args: string[]): { port: number; help: boolean } {
  let port = parseInt(process.env.PORT || "4000");
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--port" || arg === "-p") {
      const nextArg = args[i + 1];
      if (nextArg) {
        port = parseInt(nextArg);
        i++;
      }
    }
  }

  return { port, help };
}
