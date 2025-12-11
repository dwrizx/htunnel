import type { TunnelInstance } from "../types";
import { type TunnelProvider, waitForUrl } from "./base";

export const cloudflareProvider: TunnelProvider = {
  name: "cloudflare",

  async start(tunnel: TunnelInstance): Promise<void> {
    const { config } = tunnel;
    const target = `http://${config.localHost}:${config.localPort}`;

    // Log command
    tunnel.logs.push(`$ cloudflared tunnel --url ${target}`);
    tunnel.logs.push(`Starting Cloudflare tunnel...`);

    const proc = Bun.spawn(
      [
        "cloudflared",
        "tunnel",
        "--url",
        target,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    tunnel.process = proc;
    tunnel.logs.push(`Connecting to Cloudflare edge...`);

    const patterns = [/https:\/\/[a-z0-9-]+\.trycloudflare\.com/];

    try {
      const url = await waitForUrl(proc.stderr, patterns);
      tunnel.urls = [url];
      tunnel.status = "live";
      tunnel.logs.push(`Tunnel established!`);
      tunnel.logs.push(`URL: ${url}`);
    } catch (error) {
      proc.kill();
      tunnel.logs.push(`ERROR: ${error instanceof Error ? error.message : 'Failed to establish tunnel'}`);
      throw error;
    }
  },

  async stop(tunnel: TunnelInstance): Promise<void> {
    tunnel.logs.push(`Stopping tunnel...`);
    tunnel.process?.kill();
    tunnel.status = "closed";
    tunnel.logs.push(`Tunnel stopped`);
  },
};
