import localtunnel from "localtunnel";
import type { TunnelInstance } from "../types";
import type { TunnelProvider } from "./base";

async function getPublicIP(): Promise<string | null> {
  const services = [
    "https://api.ipify.org",
    "https://ifconfig.me/ip",
    "https://icanhazip.com",
  ];

  for (const service of services) {
    try {
      const response = await fetch(service, { 
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "curl/7.64.1" }
      });
      if (response.ok) {
        const ip = (await response.text()).trim();
        if (ip && /^[\d.]+$/.test(ip)) {
          return ip;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

export const localtunnelProvider: TunnelProvider = {
  name: "localtunnel",

  async start(tunnel: TunnelInstance): Promise<void> {
    const { config } = tunnel;

    const options: { port: number; subdomain?: string; local_host?: string } = {
      port: config.localPort,
    };
    
    if (config.subdomain) {
      options.subdomain = config.subdomain;
    }
    
    if (config.localHost && config.localHost !== "localhost") {
      options.local_host = config.localHost;
    }

    // Log
    tunnel.logs.push(`$ localtunnel --port ${config.localPort}${config.subdomain ? ` --subdomain ${config.subdomain}` : ''}`);
    tunnel.logs.push(`Starting localtunnel...`);

    try {
      tunnel.logs.push(`Connecting to loca.lt server...`);
      const [lt, password] = await Promise.all([
        localtunnel(options),
        getPublicIP()
      ]);
      
      // Store the tunnel instance for later cleanup
      (tunnel as any)._ltInstance = lt;
      
      tunnel.urls = [lt.url];
      tunnel.status = "live";
      tunnel.logs.push(`Tunnel established!`);
      tunnel.logs.push(`URL: ${lt.url}`);
      
      if (password) {
        tunnel.password = password;
        tunnel.extraInfo = {
          note: "Localtunnel requires password (your public IP) for first-time browser access",
          passwordUrl: "https://loca.lt/mytunnelpassword"
        };
        tunnel.logs.push(`Password (your IP): ${password}`);
      }

      // Handle tunnel close event
      lt.on("close", () => {
        if (tunnel.status === "live") {
          tunnel.status = "closed";
          tunnel.logs.push(`Tunnel closed by server`);
        }
      });

      // Handle errors
      lt.on("error", (err) => {
        tunnel.status = "error";
        tunnel.error = err.message;
        tunnel.logs.push(`ERROR: ${err.message}`);
      });
    } catch (error) {
      tunnel.status = "error";
      tunnel.logs.push(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },

  async stop(tunnel: TunnelInstance): Promise<void> {
    tunnel.logs.push(`Stopping tunnel...`);
    try {
      const lt = (tunnel as any)._ltInstance;
      if (lt) {
        lt.close();
      }
    } catch {
      // ignore errors
    }
    tunnel.status = "closed";
    tunnel.logs.push(`Tunnel stopped`);
  },
};
