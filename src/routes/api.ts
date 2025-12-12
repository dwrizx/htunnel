import { Hono } from "hono";
import { tunnelManager } from "../tunnel-manager";
import { tunnelCard, tunnelList } from "../views/components";
import type { CreateTunnelRequest, TunnelProvider, CloudflareTunnelMode } from "../types";
import { runInstallCommand, checkAllProviders, detectOS, getArch } from "../utils/cli-checker";
import { 
  autoInstall as autoInstallCloudflared,
  getInstallInstructions as getCloudflaredInstructions,
  isCloudflaredInstalled,
  getCloudflaredVersion,
  checkCloudflaredStatus,
  getPlatformInfo,
  getAvailableInstallMethods,
} from "../utils/cloudflared-installer";

export const apiRoutes = new Hono();

apiRoutes.get("/tunnels", (c) => {
  return c.html(tunnelList(tunnelManager.getAll()));
});

apiRoutes.post("/tunnels", async (c) => {
  const form = await c.req.formData();

  // Determine Cloudflare mode from form inputs
  let cloudflareMode: CloudflareTunnelMode | undefined;
  const provider = (form.get("provider") as TunnelProvider) || "pinggy";
  
  if (provider === "cloudflare") {
    const token = form.get("token") as string;
    const tunnelName = form.get("cloudflareTunnelName") as string;
    const domain = form.get("cloudflareDomain") as string;
    const modeField = form.get("cloudflareMode") as string;
    
    // Auto-detect mode if not explicitly set
    if (modeField === "local" || modeField === "token" || modeField === "quick") {
      cloudflareMode = modeField as CloudflareTunnelMode;
    } else if (token) {
      cloudflareMode = "token";
    } else if (tunnelName || domain) {
      cloudflareMode = "local";
    } else {
      cloudflareMode = "quick";
    }
  }

  const request: CreateTunnelRequest = {
    provider,
    name: (form.get("name") as string) || "Unnamed",
    localPort: parseInt(form.get("localPort") as string) || 3000,
    localHost: (form.get("localHost") as string) || "localhost",
    token: (form.get("token") as string) || undefined,
    pinggyPassword: (form.get("pinggyPassword") as string) || undefined,
    subdomain: (form.get("subdomain") as string) || undefined,
    // Cloudflare specific fields
    cloudflareMode,
    cloudflareTunnelName: (form.get("cloudflareTunnelName") as string) || undefined,
    cloudflareDomain: (form.get("cloudflareDomain") as string) || undefined,
  };

  const tunnel = await tunnelManager.create(request);
  return c.html(tunnelCard(tunnel));
});

apiRoutes.post("/tunnels/:id/stop", async (c) => {
  const id = c.req.param("id");
  await tunnelManager.stop(id);
  const tunnel = tunnelManager.get(id);
  return tunnel ? c.html(tunnelCard(tunnel)) : c.text("", 404);
});

apiRoutes.post("/tunnels/:id/restart", async (c) => {
  const id = c.req.param("id");
  const tunnel = await tunnelManager.restart(id);
  return tunnel ? c.html(tunnelCard(tunnel)) : c.text("", 404);
});

apiRoutes.delete("/tunnels/:id", (c) => {
  tunnelManager.delete(c.req.param("id"));
  return c.text("");
});

apiRoutes.get("/stats", (c) => {
  return c.json(tunnelManager.getStats());
});

apiRoutes.get("/tunnels/:id/logs", (c) => {
  const tunnel = tunnelManager.get(c.req.param("id"));
  if (!tunnel) return c.html('<span class="text-gray-600">No logs</span>');
  
  // Return formatted HTML for HTMX
  const html = tunnel.logs.map(log => {
    if (log.startsWith('$')) {
      return `<div class="text-emerald-400">${log.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
    } else if (log.startsWith('ERROR')) {
      return `<div class="text-red-400">${log.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
    } else if (log.startsWith('URL:')) {
      return `<div class="text-violet-400">${log.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
    } else if (log.includes('established') || log.includes('successfully')) {
      return `<div class="text-emerald-400">${log.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
    } else {
      return `<div class="text-gray-400">${log.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
    }
  }).join('');
  
  return c.html(html || '<span class="text-gray-600">Waiting for output...</span>');
});

apiRoutes.get("/providers/status", async (c) => {
  const statuses = await checkAllProviders();
  return c.json(statuses);
});

apiRoutes.post("/install/:provider", async (c) => {
  const provider = c.req.param("provider") as TunnelProvider;
  const result = await runInstallCommand(provider);
  return c.json(result);
});

// System info endpoint
apiRoutes.get("/system", async (c) => {
  const platformInfo = await getPlatformInfo();
  return c.json({
    platform: platformInfo.os,
    arch: platformInfo.arch,
    distro: platformInfo.distro,
    packageManager: platformInfo.packageManager,
    nodeVersion: process.version,
    bunVersion: Bun.version,
  });
});

// Cloudflared-specific endpoints
apiRoutes.get("/cloudflared/status", async (c) => {
  const status = await checkCloudflaredStatus();
  const instructions = await getCloudflaredInstructions();
  const methods = await getAvailableInstallMethods();

  return c.json({
    installed: status.installed,
    version: status.version,
    path: status.path,
    instructions,
    availableMethods: methods,
  });
});

apiRoutes.post("/cloudflared/install", async (c) => {
  // Check if already installed first
  const status = await checkCloudflaredStatus();
  if (status.installed) {
    return c.json({
      success: true,
      message: `cloudflared ${status.version} is already installed`,
      version: status.version,
      skipped: true,
    });
  }
  
  const result = await autoInstallCloudflared();
  return c.json(result);
});

apiRoutes.get("/cloudflared/instructions", async (c) => {
  const instructions = await getCloudflaredInstructions();
  return c.json(instructions);
});
