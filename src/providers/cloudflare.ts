import type { TunnelInstance, CloudflareTunnelMode } from "../types";
import type { TunnelProvider } from "./base";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * Cloudflare Tunnel Provider
 * 
 * Supports three modes:
 * 
 * 1. Quick Tunnel (default): Uses `cloudflared tunnel --url` for instant temporary tunnels
 *    - No authentication required
 *    - Random URL on .trycloudflare.com
 *    - Perfect for development/testing
 * 
 * 2. Local Tunnel: Locally-managed tunnel with credentials file
 *    - Requires `cloudflared tunnel login` first (done automatically if needed)
 *    - Creates persistent tunnel with your domain
 *    - Credentials stored in ~/.cloudflared/
 *    - Suitable for production
 * 
 * 3. Token Tunnel: Remotely-managed tunnel via Cloudflare Dashboard
 *    - Uses token from Zero Trust Dashboard
 *    - URL configured in dashboard, not in CLI
 *    - Best for team/enterprise deployments
 * 
 * @see https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/
 */

const ENV_TUNNEL_TOKEN = process.env.CLOUDFLARE_TUNNEL_TOKEN;
const CLOUDFLARED_DIR = join(homedir(), ".cloudflared");

export const cloudflareProvider: TunnelProvider = {
  name: "cloudflare",

  async start(tunnel: TunnelInstance): Promise<void> {
    const { config } = tunnel;
    const target = `http://${config.localHost}:${config.localPort}`;
    
    // Determine tunnel mode
    const mode: CloudflareTunnelMode = config.cloudflareMode || 
      (config.token || ENV_TUNNEL_TOKEN ? "token" : "quick");

    tunnel.logs.push(`Mode: ${getModeDescription(mode)}`);

    switch (mode) {
      case "token":
        await startTokenTunnel(tunnel, config.token || ENV_TUNNEL_TOKEN || "");
        break;
      case "local":
        await startLocalTunnel(tunnel, target);
        break;
      case "quick":
      default:
        await startQuickTunnel(tunnel, target);
        break;
    }
  },

  async stop(tunnel: TunnelInstance): Promise<void> {
    tunnel.logs.push(`Stopping tunnel...`);
    try {
      if (tunnel.process) {
        tunnel.process.kill();
      }
    } catch {
      // Ignore errors when killing process
    }
    tunnel.status = "closed";
    tunnel.logs.push(`Tunnel stopped`);
  },
};

function getModeDescription(mode: CloudflareTunnelMode): string {
  switch (mode) {
    case "quick": return "Quick Tunnel (temporary, random URL)";
    case "local": return "Local Tunnel (persistent, your domain)";
    case "token": return "Token Tunnel (managed via Dashboard)";
  }
}

/**
 * Start a Quick Tunnel (no auth required)
 * Creates a temporary tunnel with random URL on trycloudflare.com
 */
async function startQuickTunnel(tunnel: TunnelInstance, target: string): Promise<void> {
  const args = [
    "cloudflared",
    "tunnel",
    "--no-autoupdate",
    "--url",
    target,
  ];
  
  const displayCmd = `cloudflared tunnel --url ${target}`;
  tunnel.logs.push(`$ ${displayCmd}`);
  tunnel.logs.push(`Starting quick Cloudflare tunnel...`);
  
  tunnel.extraInfo = {
    mode: "Quick Tunnel",
    note: "Temporary tunnel - URL changes on restart",
    docs: "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/",
  };

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  tunnel.process = proc;
  tunnel.logs.push(`Connecting to Cloudflare edge network...`);

  try {
    const url = await waitForCloudflareUrl(proc.stderr, tunnel, 60000);
    tunnel.urls = [url];
    tunnel.status = "live";
    tunnel.logs.push(`Tunnel established!`);
    tunnel.logs.push(`URL: ${url}`);

    // Continue monitoring stderr for errors
    monitorStream(proc.stderr, tunnel);
  } catch (error) {
    proc.kill();
    tunnel.logs.push(`ERROR: ${error instanceof Error ? error.message : 'Failed to establish tunnel'}`);
    
    if (error instanceof Error && error.message.includes('Timeout')) {
      tunnel.logs.push(`TIP: Make sure cloudflared is installed correctly`);
      tunnel.logs.push(`TIP: Check your network connection to Cloudflare`);
    }
    throw error;
  }
}

/**
 * Start a Local Tunnel (locally-managed)
 * Uses credentials file from ~/.cloudflared/
 */
async function startLocalTunnel(tunnel: TunnelInstance, target: string): Promise<void> {
  const { config } = tunnel;
  const tunnelName = config.cloudflareTunnelName || config.name;
  const domain = config.cloudflareDomain;
  
  tunnel.logs.push(`Setting up local tunnel: ${tunnelName}`);
  
  // Step 1: Check if authenticated (cert.pem exists)
  const certPath = join(CLOUDFLARED_DIR, "cert.pem");
  const isAuthenticated = existsSync(certPath);
  
  if (!isAuthenticated) {
    tunnel.logs.push(`Authentication required. Running 'cloudflared tunnel login'...`);
    tunnel.logs.push(`A browser window will open. Please log in to Cloudflare.`);
    tunnel.extraInfo = {
      mode: "Local Tunnel",
      status: "Waiting for authentication...",
      action: "Please complete login in browser",
    };
    
    try {
      await runCloudflaredLogin(tunnel);
      tunnel.logs.push(`Authentication successful!`);
    } catch (error) {
      tunnel.logs.push(`ERROR: Authentication failed`);
      throw error;
    }
  }
  
  // Step 2: Check if tunnel exists, create if not
  const tunnelInfo = await getTunnelInfo(tunnelName);
  let tunnelId: string;
  
  if (tunnelInfo) {
    tunnelId = tunnelInfo.id;
    tunnel.logs.push(`Using existing tunnel: ${tunnelName} (${tunnelId.substring(0, 8)}...)`);
  } else {
    tunnel.logs.push(`Creating new tunnel: ${tunnelName}`);
    tunnelId = await createTunnel(tunnelName, tunnel);
    tunnel.logs.push(`Tunnel created with ID: ${tunnelId.substring(0, 8)}...`);
  }
  
  // Step 3: Create/update config file
  const configPath = join(CLOUDFLARED_DIR, `${tunnelId}.yml`);
  const credentialsPath = join(CLOUDFLARED_DIR, `${tunnelId}.json`);
  
  const configContent = generateConfig({
    tunnelId,
    credentialsPath,
    target,
    domain,
  });
  
  await Bun.write(configPath, configContent);
  tunnel.logs.push(`Config written to: ${configPath}`);
  
  // Step 4: Setup DNS route if domain provided
  if (domain) {
    tunnel.logs.push(`Setting up DNS route: ${domain} -> ${tunnelName}`);
    try {
      await setupDnsRoute(tunnelId, domain, tunnel);
      tunnel.logs.push(`DNS route configured: ${domain}`);
    } catch (error) {
      tunnel.logs.push(`Warning: DNS setup may have failed (might already exist)`);
    }
  }
  
  // Step 5: Run the tunnel
  tunnel.logs.push(`Starting tunnel...`);
  
  const args = [
    "cloudflared",
    "tunnel",
    "--no-autoupdate",
    "--config",
    configPath,
    "run",
    tunnelId,
  ];
  
  const displayCmd = `cloudflared tunnel --config ${configPath} run ${tunnelId}`;
  tunnel.logs.push(`$ ${displayCmd}`);
  
  tunnel.extraInfo = {
    mode: "Local Tunnel",
    tunnelId: tunnelId,
    tunnelName: tunnelName,
    configPath: configPath,
    domain: domain || "cfargotunnel subdomain",
    docs: "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/",
  };
  
  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });
  
  tunnel.process = proc;
  
  try {
    const connected = await waitForConnection(proc.stderr, tunnel, 30000);
    if (connected) {
      tunnel.status = "live";
      tunnel.logs.push(`Tunnel connected!`);
      
      // Set URLs
      if (domain) {
        tunnel.urls = [`https://${domain}`];
        tunnel.logs.push(`URL: https://${domain}`);
      } else {
        tunnel.urls = [`https://${tunnelId}.cfargotunnel.com`];
        tunnel.logs.push(`URL: https://${tunnelId}.cfargotunnel.com`);
      }
      
      // Monitor for errors
      monitorStream(proc.stderr, tunnel);
    }
  } catch (error) {
    proc.kill();
    tunnel.logs.push(`ERROR: ${error instanceof Error ? error.message : 'Failed to connect'}`);
    throw error;
  }
}

/**
 * Start a Token-based Tunnel (remotely managed)
 * Uses token from Cloudflare Zero Trust Dashboard
 */
async function startTokenTunnel(tunnel: TunnelInstance, token: string): Promise<void> {
  if (!token) {
    throw new Error("Token is required for token-based tunnels");
  }
  
  const args = [
    "cloudflared",
    "tunnel",
    "--no-autoupdate",
    "run",
    "--token",
    token,
  ];
  
  const displayCmd = `cloudflared tunnel run --token ***`;
  tunnel.logs.push(`$ ${displayCmd}`);
  tunnel.logs.push(`Starting named Cloudflare tunnel with token...`);
  tunnel.logs.push(`Note: URL is configured in your Cloudflare Dashboard`);
  
  tunnel.extraInfo = {
    mode: "Named Tunnel (Token)",
    note: "URL is configured in Cloudflare Zero Trust Dashboard",
    dashboard: "https://one.dash.cloudflare.com/",
  };
  
  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });
  tunnel.process = proc;
  
  try {
    const connected = await waitForConnection(proc.stderr, tunnel, 30000);
    if (connected) {
      tunnel.status = "live";
      tunnel.logs.push(`Tunnel connected to Cloudflare!`);
      tunnel.logs.push(`Check your Cloudflare Dashboard for the URL`);
      tunnel.urls = ["See Cloudflare Dashboard"];
      
      // Monitor for errors
      monitorStream(proc.stderr, tunnel);
    }
  } catch (error) {
    proc.kill();
    tunnel.logs.push(`ERROR: ${error instanceof Error ? error.message : 'Failed to connect'}`);
    throw error;
  }
}

/**
 * Run cloudflared tunnel login
 */
async function runCloudflaredLogin(tunnel: TunnelInstance): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = Bun.spawn(["cloudflared", "tunnel", "login"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error("Login timeout (120s)"));
    }, 120000);
    
    proc.exited.then((code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Login failed with code ${code}`));
      }
    });
    
    // Monitor stderr for progress
    monitorLoginProgress(proc.stderr, tunnel);
  });
}

/**
 * Monitor login progress
 */
async function monitorLoginProgress(
  stream: ReadableStream<Uint8Array>,
  tunnel: TunnelInstance
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value, { stream: true });
      if (text.includes("browser")) {
        tunnel.logs.push(`Browser opened for authentication`);
      }
      if (text.includes("certificate")) {
        tunnel.logs.push(`Certificate received`);
      }
    }
  } catch {
    // Stream ended
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get info about an existing tunnel
 */
async function getTunnelInfo(name: string): Promise<{ id: string; name: string } | null> {
  try {
    const proc = Bun.spawn(["cloudflared", "tunnel", "list", "--output", "json"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    
    if (exitCode !== 0) return null;
    
    const tunnels = JSON.parse(output || "[]");
    const found = tunnels.find((t: { name: string }) => t.name === name);
    
    return found ? { id: found.id, name: found.name } : null;
  } catch {
    return null;
  }
}

/**
 * Create a new tunnel
 */
async function createTunnel(name: string, tunnel: TunnelInstance): Promise<string> {
  const proc = Bun.spawn(["cloudflared", "tunnel", "create", name], {
    stdout: "pipe",
    stderr: "pipe",
  });
  
  const output = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  
  if (exitCode !== 0) {
    throw new Error(`Failed to create tunnel: ${output}`);
  }
  
  // Extract tunnel ID from output
  // Output format: "Tunnel credentials written to /path/to/UUID.json"
  const idMatch = output.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  
  if (!idMatch || !idMatch[1]) {
    // Try to get ID from tunnel list
    const info = await getTunnelInfo(name);
    if (info) return info.id;
    throw new Error("Could not get tunnel ID");
  }
  
  return idMatch[1];
}

/**
 * Generate config.yml content
 */
function generateConfig(options: {
  tunnelId: string;
  credentialsPath: string;
  target: string;
  domain?: string;
}): string {
  const { tunnelId, credentialsPath, target, domain } = options;
  
  let config = `# Cloudflare Tunnel configuration
# Generated by HadesTunnel
tunnel: ${tunnelId}
credentials-file: ${credentialsPath}

ingress:
`;

  if (domain) {
    config += `  - hostname: ${domain}
    service: ${target}
`;
  }
  
  // Catch-all rule (required)
  config += `  - service: ${target}
`;

  return config;
}

/**
 * Setup DNS route for tunnel
 */
async function setupDnsRoute(
  tunnelId: string,
  domain: string,
  tunnel: TunnelInstance
): Promise<void> {
  const proc = Bun.spawn(["cloudflared", "tunnel", "route", "dns", tunnelId, domain], {
    stdout: "pipe",
    stderr: "pipe",
  });
  
  const output = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  
  // exitCode 1 might mean route already exists, which is OK
  if (exitCode !== 0 && !output.includes("already exists")) {
    tunnel.logs.push(`DNS route warning: ${output.substring(0, 100)}`);
  }
}

/**
 * Wait for tunnel connection confirmation
 */
async function waitForConnection(
  stream: ReadableStream<Uint8Array>,
  tunnel: TunnelInstance,
  timeoutMs: number
): Promise<boolean> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for tunnel connection"));
    }, timeoutMs);

    const processChunk = async () => {
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            clearTimeout(timeout);
            reject(new Error("Stream ended without connection"));
            return;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Log progress
          if (chunk.includes("INF")) {
            const infMatch = chunk.match(/INF\s+(.+)/);
            if (infMatch && infMatch[1]) {
              tunnel.logs.push(`[cloudflared] ${infMatch[1].substring(0, 80)}`);
            }
          }

          // Check for successful connection
          if (buffer.includes("Registered tunnel connection") || 
              buffer.includes("Connection registered") ||
              buffer.includes("connIndex=0") ||
              buffer.includes("Tunnel server said")) {
            clearTimeout(timeout);
            reader.releaseLock();
            resolve(true);
            return;
          }

          // Check for errors
          if (buffer.includes("error") && buffer.includes("failed")) {
            const errorMatch = buffer.match(/ERR[^\n]+/);
            clearTimeout(timeout);
            reader.releaseLock();
            reject(new Error(errorMatch?.[0] || "Connection failed"));
            return;
          }
        }
      } catch (err) {
        clearTimeout(timeout);
        reader.releaseLock();
        reject(err);
      }
    };

    processChunk();
  });
}

/**
 * Wait for Cloudflare tunnel URL from stderr (for Quick Tunnel)
 */
async function waitForCloudflareUrl(
  stream: ReadableStream<Uint8Array>,
  tunnel: TunnelInstance,
  timeoutMs: number
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for tunnel URL"));
    }, timeoutMs);

    const processChunk = async () => {
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            clearTimeout(timeout);
            reject(new Error("Stream ended without finding URL"));
            return;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Log progress messages
          if (chunk.includes("Requesting new quick Tunnel")) {
            tunnel.logs.push(`Requesting new quick Tunnel...`);
          }
          if (chunk.includes("Your quick Tunnel has been created")) {
            tunnel.logs.push(`Quick Tunnel created, getting URL...`);
          }
          if (chunk.includes("Registered tunnel connection")) {
            tunnel.logs.push(`Tunnel connection registered`);
          }

          // Pattern 1: URL in box format (most common for quick tunnels)
          const boxUrlMatch = buffer.match(/\|\s*(https:\/\/[a-z0-9-]+\.trycloudflare\.com)\s*\|/i);
          if (boxUrlMatch && boxUrlMatch[1]) {
            clearTimeout(timeout);
            reader.releaseLock();
            resolve(boxUrlMatch[1]);
            return;
          }

          // Pattern 2: Direct URL in log line
          const directUrlMatch = buffer.match(/INF\s+(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i);
          if (directUrlMatch && directUrlMatch[1]) {
            clearTimeout(timeout);
            reader.releaseLock();
            resolve(directUrlMatch[1]);
            return;
          }

          // Pattern 3: URL anywhere in output (fallback)
          const anyUrlMatch = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
          if (anyUrlMatch) {
            await new Promise(r => setTimeout(r, 1000));
            clearTimeout(timeout);
            reader.releaseLock();
            resolve(anyUrlMatch[0]);
            return;
          }

          // Pattern 4: cfargotunnel.com domain (for named tunnels)
          const cfargotunnelMatch = buffer.match(/https:\/\/[a-z0-9-]+\.cfargotunnel\.com/i);
          if (cfargotunnelMatch) {
            clearTimeout(timeout);
            reader.releaseLock();
            resolve(cfargotunnelMatch[0]);
            return;
          }

          // Check for errors
          if (buffer.includes("failed to connect") || buffer.includes("error")) {
            const errorMatch = buffer.match(/ERR[^\n]+/);
            if (errorMatch) {
              tunnel.logs.push(`[cloudflared] ${errorMatch[0]}`);
            }
          }
        }
      } catch (err) {
        clearTimeout(timeout);
        reader.releaseLock();
        reject(err);
      }
    };

    processChunk();
  });
}

/**
 * Monitor a stream for additional output (for logging purposes)
 */
async function monitorStream(
  stream: ReadableStream<Uint8Array> | null,
  tunnel: TunnelInstance
): Promise<void> {
  if (!stream) return;
  
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value, { stream: true });
      if (text.includes('ERR') || text.includes('error')) {
        const lines = text.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          if (!tunnel.logs.includes(line) && line.includes('ERR')) {
            tunnel.logs.push(`[cloudflared] ${line.trim()}`);
          }
        });
      }
    }
  } catch {
    // Stream ended or errored
  } finally {
    reader.releaseLock();
  }
}

/**
 * Utility functions for cloudflared management
 */
export const cloudflaredUtils = {
  /**
   * Check if cloudflared is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      const proc = Bun.spawn(["cloudflared", "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      return exitCode === 0;
    } catch {
      return false;
    }
  },

  /**
   * Get cloudflared version
   */
  async getVersion(): Promise<string | null> {
    try {
      const proc = Bun.spawn(["cloudflared", "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = await new Response(proc.stdout).text();
      const match = output.match(/cloudflared version (\d+\.\d+\.\d+)/);
      return match?.[1] ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const certPath = join(CLOUDFLARED_DIR, "cert.pem");
    return existsSync(certPath);
  },

  /**
   * List all tunnels
   */
  async listTunnels(): Promise<Array<{ id: string; name: string; created: string }>> {
    try {
      const proc = Bun.spawn(["cloudflared", "tunnel", "list", "--output", "json"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = await new Response(proc.stdout).text();
      return JSON.parse(output || "[]");
    } catch {
      return [];
    }
  },

  /**
   * Delete a tunnel
   */
  async deleteTunnel(nameOrId: string): Promise<boolean> {
    try {
      const proc = Bun.spawn(["cloudflared", "tunnel", "delete", nameOrId], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      return exitCode === 0;
    } catch {
      return false;
    }
  },

  /**
   * Get installation command for the current platform
   */
  getInstallCommand(): { command: string; description: string } {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === "darwin") {
      return {
        command: "brew install cloudflared",
        description: "Install using Homebrew (macOS)",
      };
    }

    if (platform === "win32") {
      return {
        command: "winget install --id Cloudflare.cloudflared",
        description: "Install using winget (Windows)",
      };
    }

    const archMap: Record<string, string> = {
      x64: "amd64",
      arm64: "arm64",
      arm: "arm",
    };
    const linuxArch = archMap[arch] || "amd64";

    return {
      command: `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${linuxArch} -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared`,
      description: `Install binary (Linux ${arch})`,
    };
  },

  /**
   * Get detailed installation instructions for all platforms
   */
  getInstallInstructions(): Record<string, string[]> {
    return {
      linux_debian: [
        "# Add Cloudflare's package signing key",
        "sudo mkdir -p --mode=0755 /usr/share/keyrings",
        "curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null",
        "",
        "# Add Cloudflare's apt repo",
        'echo "deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list',
        "",
        "# Install cloudflared",
        "sudo apt-get update && sudo apt-get install cloudflared",
      ],
      linux_rhel: [
        "# Add Cloudflare's repository",
        "curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | sudo tee /etc/yum.repos.d/cloudflared.repo",
        "",
        "# Install cloudflared",
        "sudo yum update && sudo yum install cloudflared",
      ],
      linux_arch: [
        "# Install from community repository",
        "pacman -Syu cloudflared",
      ],
      linux_binary: [
        "# Download and install binary directly",
        "curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared",
        "chmod +x cloudflared",
        "sudo mv cloudflared /usr/local/bin/",
      ],
      macos: [
        "# Install using Homebrew",
        "brew install cloudflared",
      ],
      windows: [
        "# Option 1: Using winget (recommended)",
        "winget install --id Cloudflare.cloudflared",
        "",
        "# Option 2: Using Chocolatey",
        "choco install cloudflared",
        "",
        "# Option 3: Manual download",
        "# Download from: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/",
        "# Rename to cloudflared.exe and add to PATH",
      ],
    };
  },
};
