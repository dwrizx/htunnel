import { Hono } from "hono";
import { tunnelManager } from "../tunnel-manager";
import { tunnelCard, tunnelList } from "../views/components";
import type {
  CreateTunnelRequest,
  TunnelProvider,
  CloudflareTunnelMode,
  TunnelInstance,
} from "../types";
import {
  runInstallCommand,
  checkAllProviders,
  runUpdateCommand,
} from "../utils/cli-checker";
import {
  autoInstall as autoInstallCloudflared,
  getInstallInstructions as getCloudflaredInstructions,
  checkCloudflaredStatus,
  getPlatformInfo,
  getAvailableInstallMethods,
} from "../utils/cloudflared-installer";

export const apiRoutes = new Hono();

function resolveCloudflareMode(payload: Partial<CreateTunnelRequest>) {
  if (payload.provider !== "cloudflare") {
    return undefined;
  }

  if (
    payload.cloudflareMode === "quick" ||
    payload.cloudflareMode === "local" ||
    payload.cloudflareMode === "token"
  ) {
    return payload.cloudflareMode;
  }
  if (payload.token) {
    return "token" as const;
  }
  if (payload.cloudflareTunnelName || payload.cloudflareDomain) {
    return "local" as const;
  }
  return "quick" as const;
}

function serializeTunnel(tunnel: TunnelInstance) {
  return {
    id: tunnel.config.id,
    status: tunnel.status,
    urls: tunnel.urls,
    error: tunnel.error,
    logs: tunnel.logs,
    password: tunnel.password,
    extraInfo: tunnel.extraInfo,
    startedAt: tunnel.startedAt?.toISOString() ?? null,
    config: {
      id: tunnel.config.id,
      provider: tunnel.config.provider,
      name: tunnel.config.name,
      localPort: tunnel.config.localPort,
      localHost: tunnel.config.localHost,
      token: tunnel.config.token,
      subdomain: tunnel.config.subdomain,
      createdAt: tunnel.config.createdAt.toISOString(),
      cloudflareMode: tunnel.config.cloudflareMode,
      cloudflareTunnelName: tunnel.config.cloudflareTunnelName,
      cloudflareDomain: tunnel.config.cloudflareDomain,
    },
  };
}

function createSseStream(
  onTick: () => Promise<string> | string,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = async () => {
        if (closed) return;
        try {
          const payload = await onTick();
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`,
            ),
          );
        }
      };

      const interval = setInterval(() => {
        void write();
      }, 1000);

      void write();

      const onAbort = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        controller.close();
      };

      signal.addEventListener("abort", onAbort, { once: true });
    },
  });
}

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
    if (
      modeField === "local" ||
      modeField === "token" ||
      modeField === "quick"
    ) {
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
    cloudflareTunnelName:
      (form.get("cloudflareTunnelName") as string) || undefined,
    cloudflareDomain: (form.get("cloudflareDomain") as string) || undefined,
  };

  const tunnel = await tunnelManager.create(request);
  return c.html(tunnelCard(tunnel));
});

// React/JSON API
apiRoutes.get("/v1/tunnels", (c) => {
  return c.json({
    tunnels: tunnelManager.getAll().map(serializeTunnel),
  });
});

apiRoutes.get("/v1/tunnels/events", (c) => {
  const stream = createSseStream(() => {
    return JSON.stringify({
      tunnels: tunnelManager.getAll().map(serializeTunnel),
      stats: tunnelManager.getStats(),
    });
  }, c.req.raw.signal);

  return c.body(stream, 200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
});

apiRoutes.get("/v1/tunnels/:id", (c) => {
  const tunnel = tunnelManager.get(c.req.param("id"));
  if (!tunnel) {
    return c.json({ error: "Tunnel not found" }, 404);
  }
  return c.json({ tunnel: serializeTunnel(tunnel) });
});

apiRoutes.get("/v1/tunnels/:id/events", (c) => {
  const id = c.req.param("id");
  const stream = createSseStream(() => {
    const tunnel = tunnelManager.get(id);
    return JSON.stringify({
      tunnel: tunnel ? serializeTunnel(tunnel) : null,
      notFound: !tunnel,
    });
  }, c.req.raw.signal);

  return c.body(stream, 200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
});

apiRoutes.post("/v1/tunnels", async (c) => {
  let payload: Partial<CreateTunnelRequest> = {};
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const provider = payload.provider || "pinggy";
  if (
    provider !== "pinggy" &&
    provider !== "cloudflare" &&
    provider !== "ngrok" &&
    provider !== "localtunnel"
  ) {
    return c.json({ error: "Invalid provider" }, 400);
  }

  const request: CreateTunnelRequest = {
    provider,
    name: payload.name || "Unnamed",
    localPort: payload.localPort || 3000,
    localHost: payload.localHost || "localhost",
    token: payload.token || undefined,
    subdomain: payload.subdomain || undefined,
    cloudflareMode: resolveCloudflareMode({
      ...payload,
      provider,
    }),
    cloudflareTunnelName: payload.cloudflareTunnelName,
    cloudflareDomain: payload.cloudflareDomain,
  };

  const tunnel = await tunnelManager.create(request);
  return c.json({ tunnel: serializeTunnel(tunnel) });
});

apiRoutes.patch("/v1/tunnels/:id", async (c) => {
  const id = c.req.param("id");
  let payload: Partial<CreateTunnelRequest> = {};
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (
    payload.provider &&
    payload.provider !== "pinggy" &&
    payload.provider !== "cloudflare" &&
    payload.provider !== "ngrok" &&
    payload.provider !== "localtunnel"
  ) {
    return c.json({ error: "Invalid provider" }, 400);
  }

  if (
    payload.localPort !== undefined &&
    (!Number.isInteger(payload.localPort) ||
      payload.localPort < 1 ||
      payload.localPort > 65535)
  ) {
    return c.json({ error: "Invalid localPort" }, 400);
  }

  const existing = tunnelManager.get(id);
  if (!existing) {
    return c.json({ error: "Tunnel not found" }, 404);
  }

  const provider = payload.provider ?? existing.config.provider;
  const updated = await tunnelManager.update(id, {
    provider,
    name: payload.name ?? existing.config.name,
    localPort: payload.localPort ?? existing.config.localPort,
    localHost: payload.localHost ?? existing.config.localHost,
    token: payload.token ?? existing.config.token,
    subdomain: payload.subdomain ?? existing.config.subdomain,
    cloudflareMode: resolveCloudflareMode({
      ...payload,
      provider,
    }),
    cloudflareTunnelName:
      payload.cloudflareTunnelName ?? existing.config.cloudflareTunnelName,
    cloudflareDomain:
      payload.cloudflareDomain ?? existing.config.cloudflareDomain,
  });

  if (!updated) {
    return c.json({ error: "Tunnel not found" }, 404);
  }

  return c.json({ tunnel: serializeTunnel(updated) });
});

apiRoutes.post("/v1/tunnels/:id/stop", async (c) => {
  const id = c.req.param("id");
  const stopped = await tunnelManager.stop(id);
  if (!stopped) {
    return c.json({ error: "Tunnel not found or failed to stop" }, 404);
  }
  const tunnel = tunnelManager.get(id);
  return c.json({ tunnel: tunnel ? serializeTunnel(tunnel) : null });
});

apiRoutes.post("/v1/tunnels/:id/restart", async (c) => {
  const id = c.req.param("id");
  const tunnel = await tunnelManager.restart(id);
  if (!tunnel) {
    return c.json({ error: "Tunnel not found" }, 404);
  }
  return c.json({ tunnel: serializeTunnel(tunnel) });
});

apiRoutes.delete("/v1/tunnels/:id", (c) => {
  const deleted = tunnelManager.delete(c.req.param("id"));
  return c.json({ deleted });
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
  const html = tunnel.logs
    .map((log) => {
      if (log.startsWith("$")) {
        return `<div class="text-emerald-400">${log.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
      } else if (log.startsWith("ERROR")) {
        return `<div class="text-red-400">${log.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
      } else if (log.startsWith("URL:")) {
        return `<div class="text-violet-400">${log.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
      } else if (log.includes("established") || log.includes("successfully")) {
        return `<div class="text-emerald-400">${log.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
      } else {
        return `<div class="text-gray-400">${log.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
      }
    })
    .join("");

  return c.html(
    html || '<span class="text-gray-600">Waiting for output...</span>',
  );
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

apiRoutes.post("/providers/:provider/update", async (c) => {
  const provider = c.req.param("provider") as TunnelProvider;
  if (
    provider !== "pinggy" &&
    provider !== "cloudflare" &&
    provider !== "ngrok" &&
    provider !== "localtunnel"
  ) {
    return c.json({ success: false, error: "Invalid provider" }, 400);
  }

  const result = await runUpdateCommand(provider);
  return c.json(result, result.success ? 200 : 500);
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
