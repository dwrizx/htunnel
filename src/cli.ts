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

INSTALLATION GUIDES:

  Cloudflare Tunnel:
    # macOS
    brew install cloudflared
    
    # Linux
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
    chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/

  ngrok:
    # macOS
    brew install ngrok
    
    # Linux
    curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc
    echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
    sudo apt update && sudo apt install ngrok

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
