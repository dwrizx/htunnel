import { pinggy, type TunnelInstance as PinggySdkTunnel } from "@pinggy/pinggy";
import type { TunnelInstance } from "../types";
import type { TunnelProvider } from "./base";

const ENV_TOKEN = process.env.PINGGY_TOKEN;

export const pinggyProvider: TunnelProvider = {
  name: "pinggy",

  async start(tunnel: TunnelInstance): Promise<void> {
    const { config } = tunnel;
    const token = config.token || ENV_TOKEN;
    const localTarget = `${config.localHost || "localhost"}:${config.localPort}`;
    tunnel.logs.push(
      `$ pinggy.forward({ forwarding: "${localTarget}"${token ? ", token: ***" : ""} })`,
    );
    tunnel.logs.push(`Connecting to Pinggy...`);

    // Always add bypass info for Pinggy
    tunnel.extraInfo = {
      bypassHeader: "X-Pinggy-No-Screen: true",
      bypassNote: "Add this header to skip the warning page (for API/webhooks)",
    };

    try {
      const sdkTunnel = await pinggy.forward({
        forwarding: localTarget,
        token: token || undefined,
      });
      (tunnel as { _pinggyTunnel?: PinggySdkTunnel })._pinggyTunnel = sdkTunnel;

      const urls = await waitForSdkUrls(sdkTunnel);
      if (urls.length === 0) {
        throw new Error("Pinggy SDK did not return a public URL");
      }

      tunnel.urls = urls;
      tunnel.status = "live";
      tunnel.logs.push(`Tunnel established successfully!`);
      urls.forEach((url) => tunnel.logs.push(`URL: ${url}`));

      if (token) {
        tunnel.extraInfo.note = "Using Pinggy authenticated mode";
        tunnel.extraInfo.tokenSource = config.token ? "form" : "env";
      } else {
        tunnel.extraInfo.note = "Using Pinggy free mode";
      }
      return;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      tunnel.status = "error";
      tunnel.logs.push(`ERROR: Pinggy SDK failed: ${reason}`);
      throw error;
    }
  },

  async stop(tunnel: TunnelInstance): Promise<void> {
    tunnel.logs.push(`Stopping tunnel...`);
    try {
      const sdkTunnel = (tunnel as { _pinggyTunnel?: PinggySdkTunnel })
        ._pinggyTunnel;
      if (sdkTunnel) {
        await sdkTunnel.stop();
      }
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

async function waitForSdkUrls(
  sdkTunnel: PinggySdkTunnel,
  timeoutMs = 30000,
): Promise<string[]> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const urls = await sdkTunnel.urls();
    if (urls.length > 0) {
      return urls;
    }

    const status = await sdkTunnel.getStatus();
    if (status === "closed") {
      break;
    }

    await Bun.sleep(500);
  }

  return [];
}
