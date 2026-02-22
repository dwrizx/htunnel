import type { TunnelInstance } from "../types";
import type { TunnelProvider } from "./base";

const ENV_AUTHTOKEN = process.env.NGROK_AUTHTOKEN;

export const ngrokProvider: TunnelProvider = {
  name: "ngrok",

  async start(tunnel: TunnelInstance): Promise<void> {
    const { config } = tunnel;
    const authtoken = config.token || ENV_AUTHTOKEN;
    const localTarget =
      config.localHost && config.localHost !== "localhost"
        ? `${config.localHost}:${config.localPort}`
        : `${config.localPort}`;

    const args = ["http", localTarget];

    if (authtoken) {
      args.push("--authtoken", authtoken);
    }

    // Log command
    const displayCmd = authtoken
      ? `ngrok http ${localTarget} --authtoken ***`
      : `ngrok http ${localTarget}`;
    tunnel.logs.push(`$ ${displayCmd}`);
    tunnel.logs.push(`Starting ngrok...`);

    const proc = Bun.spawn(["ngrok", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });

    tunnel.process = proc;

    // Add info about ngrok
    tunnel.extraInfo = {
      dashboard: "http://127.0.0.1:4040",
      dashboardNote: "Local ngrok dashboard for request inspection",
    };

    if (authtoken) {
      tunnel.extraInfo.authSource = config.token
        ? "form"
        : "env (NGROK_AUTHTOKEN)";
      tunnel.logs.push(`Using authtoken from ${tunnel.extraInfo.authSource}`);
    }

    // Wait for ngrok to start and get URL from API
    tunnel.logs.push(`Waiting for ngrok API...`);
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      tunnel.logs.push(`Attempt ${attempt + 1}/${maxAttempts}...`);

      try {
        const response = await fetch("http://127.0.0.1:4040/api/tunnels");
        const data = (await response.json()) as {
          tunnels: Array<{ public_url: string; proto: string }>;
        };

        if (data.tunnels && data.tunnels.length > 0) {
          tunnel.urls = data.tunnels.map((t) => t.public_url);
          tunnel.status = "live";
          tunnel.logs.push(`Tunnel established!`);
          tunnel.urls.forEach((url) => tunnel.logs.push(`URL: ${url}`));
          return;
        }
      } catch {
        // API not ready yet, continue waiting
      }
    }

    // If we couldn't get URLs from API, check if process is still running
    if (tunnel.process) {
      tunnel.status = "error";
      tunnel.error =
        "Failed to get tunnel URL from ngrok. Make sure authtoken is valid.";
      tunnel.logs.push(`ERROR: ${tunnel.error}`);
    }
  },

  async stop(tunnel: TunnelInstance): Promise<void> {
    tunnel.logs.push(`Stopping tunnel...`);
    try {
      if (tunnel.process) {
        tunnel.process.kill();
      }
    } catch {
      // ignore
    }
    tunnel.status = "closed";
    tunnel.logs.push(`Tunnel stopped`);
  },
};
