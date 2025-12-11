import { spawn, type Subprocess } from "bun";
import type { TunnelInstance } from "../types";
import type { TunnelProvider } from "./base";

const ENV_TOKEN = process.env.PINGGY_TOKEN;
const ENV_PASSWORD = process.env.PINGGY_PASSWORD;

export const pinggyProvider: TunnelProvider = {
  name: "pinggy",

  async start(tunnel: TunnelInstance): Promise<void> {
    const { config } = tunnel;
    const token = config.token || ENV_TOKEN;
    const password = config.pinggyPassword || ENV_PASSWORD;
    const localTarget = `${config.localHost || "localhost"}:${config.localPort}`;

    // Pinggy free: ssh -p 443 -R0:localhost:PORT free.pinggy.io
    // Pinggy Pro: sshpass -p PASSWORD ssh -p 443 -R0:localhost:PORT TOKEN@a.pinggy.io
    
    const sshArgs = [
      "-p", "443",
      "-R", `0:${localTarget}`,
      "-o", "StrictHostKeyChecking=no",
      "-o", "ServerAliveInterval=30",
      "-o", "UserKnownHostsFile=/dev/null",
      "-o", "LogLevel=ERROR",
      "-tt",
    ];

    let command: string[];
    
    if (token && password) {
      // Pinggy Pro with token + password
      sshArgs.push(`${token}@a.pinggy.io`);
      command = ["sshpass", "-p", password, "ssh", ...sshArgs];
    } else {
      // Free tier - no auth needed
      sshArgs.push("free.pinggy.io");
      command = ["ssh", ...sshArgs];
    }

    // Log the command being executed (hide password)
    const displayCmd = token && password 
      ? `sshpass -p *** ssh ${sshArgs.join(" ")}`
      : `ssh ${sshArgs.join(" ")}`;
    tunnel.logs.push(`$ ${displayCmd}`);
    tunnel.logs.push(`Connecting to Pinggy...`);

    const proc = spawn(command, {
      stdout: "pipe",
      stderr: "pipe",
    });

    tunnel.process = proc;

    // Always add bypass info for Pinggy
    tunnel.extraInfo = {
      bypassHeader: "X-Pinggy-No-Screen: true",
      bypassNote: "Add this header to skip the warning page (for API/webhooks)",
    };

    if (token && password) {
      tunnel.extraInfo.note = "Using Pinggy Pro for persistent URL";
      tunnel.extraInfo.tokenSource = config.token ? "form" : "env";
      tunnel.logs.push(`Using Pinggy Pro (token: ${token.slice(0, 4)}...)`);
    } else {
      tunnel.logs.push(`Using Pinggy Free tier`);
    }

    const urls = await waitForUrls(proc, tunnel);
    if (urls.length > 0) {
      tunnel.urls = urls;
      tunnel.status = "live";
      tunnel.logs.push(`Tunnel established successfully!`);
      urls.forEach(url => tunnel.logs.push(`URL: ${url}`));
    } else {
      proc.kill();
      tunnel.status = "error";
      tunnel.logs.push(`ERROR: Failed to get tunnel URL`);
      throw new Error("Failed to get tunnel URL from Pinggy");
    }
  },

  async stop(tunnel: TunnelInstance): Promise<void> {
    tunnel.logs.push(`Stopping tunnel...`);
    try {
      if (tunnel.process) {
        tunnel.process.kill();
      }
    } catch {
      // ignore errors
    }
    tunnel.status = "closed";
    tunnel.logs.push(`Tunnel stopped`);
  },
};

async function waitForUrls(proc: Subprocess, tunnel: TunnelInstance): Promise<string[]> {
  const timeout = 30000;
  const startTime = Date.now();
  let buffer = "";
  const urls: string[] = [];

  const stdout = proc.stdout;
  if (!stdout || typeof stdout === "number") return [];

  const reader = stdout.getReader();

  try {
    while (Date.now() - startTime < timeout) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += new TextDecoder().decode(value);
      
      // Pinggy outputs URLs like:
      // http://xxxxx-xx-xx-xx-xx.a.free.pinggy.link
      // https://xxxxx-xx-xx-xx-xx.a.free.pinggy.link
      const urlMatches = buffer.matchAll(/(https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pinggy\.(?:io|link))/gi);
      for (const match of urlMatches) {
        const url = match[1];
        if (url && !urls.includes(url)) {
          urls.push(url);
        }
      }
      
      // Once we have both http and https URLs, we're done
      if (urls.length >= 2) {
        reader.releaseLock();
        return urls;
      }
      
      // Also check for single URL pattern completion
      if (urls.length > 0 && buffer.includes("You can access")) {
        reader.releaseLock();
        return urls;
      }
    }
  } catch {
    // ignore read errors
  }

  return urls;
}
