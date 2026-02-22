export type ProviderStatus = {
  provider: "pinggy" | "cloudflare" | "ngrok" | "localtunnel";
  installed: boolean;
  version?: string;
};

export type TunnelStats = {
  total: number;
  live: number;
  error: number;
  closed: number;
};

export type TunnelStatus = "starting" | "live" | "closed" | "error";

export type TunnelItem = {
  id: string;
  status: TunnelStatus;
  urls: string[];
  error?: string;
  logs: string[];
  password?: string;
  extraInfo?: Record<string, string>;
  startedAt: string | null;
  config: {
    id: string;
    provider: ProviderStatus["provider"];
    name: string;
    localPort: number;
    localHost: string;
    token?: string;
    subdomain?: string;
    createdAt: string;
    cloudflareMode?: "quick" | "local" | "token";
    cloudflareTunnelName?: string;
    cloudflareDomain?: string;
  };
};

export async function getProviderStatus(): Promise<ProviderStatus[]> {
  const response = await fetch("/api/providers/status");
  if (!response.ok) throw new Error("Failed to fetch provider status");
  return (await response.json()) as ProviderStatus[];
}

export async function updateProviderTool(
  provider: ProviderStatus["provider"],
): Promise<{
  success: boolean;
  output: string;
  versionBefore?: string;
  versionAfter?: string;
  updated: boolean;
}> {
  const response = await fetch(`/api/providers/${provider}/update`, {
    method: "POST",
  });
  const payload = (await response.json()) as {
    success: boolean;
    output: string;
    versionBefore?: string;
    versionAfter?: string;
    updated: boolean;
  };
  if (!response.ok) {
    throw new Error(payload.output || "Failed to update provider tool");
  }
  return payload;
}

export async function getTunnelStats(): Promise<TunnelStats> {
  const response = await fetch("/api/stats");
  if (!response.ok) throw new Error("Failed to fetch tunnel stats");
  return (await response.json()) as TunnelStats;
}

export async function getTunnels(): Promise<TunnelItem[]> {
  const response = await fetch("/api/v1/tunnels");
  if (!response.ok) throw new Error("Failed to fetch tunnels");
  const payload = (await response.json()) as { tunnels: TunnelItem[] };
  return payload.tunnels;
}

export async function getTunnelById(id: string): Promise<TunnelItem> {
  const response = await fetch(`/api/v1/tunnels/${id}`);
  if (!response.ok) throw new Error("Failed to fetch tunnel");
  const payload = (await response.json()) as { tunnel: TunnelItem };
  return payload.tunnel;
}

export type CreateTunnelInput = {
  provider: ProviderStatus["provider"];
  name: string;
  localPort: number;
  localHost: string;
  token?: string;
  cloudflareMode?: "quick" | "local" | "token";
  cloudflareTunnelName?: string;
  cloudflareDomain?: string;
};

export type UpdateTunnelInput = Partial<CreateTunnelInput> & {
  name: string;
  localPort: number;
  localHost: string;
  provider: ProviderStatus["provider"];
};

export async function createTunnel(input: CreateTunnelInput): Promise<void> {
  const response = await fetch("/api/v1/tunnels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Failed to create tunnel");
  }
}

export async function updateTunnel(
  id: string,
  input: UpdateTunnelInput,
): Promise<void> {
  const response = await fetch(`/api/v1/tunnels/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Failed to update tunnel");
}

export async function stopTunnel(id: string): Promise<void> {
  const response = await fetch(`/api/v1/tunnels/${id}/stop`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to stop tunnel");
}

export async function restartTunnel(id: string): Promise<void> {
  const response = await fetch(`/api/v1/tunnels/${id}/restart`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to restart tunnel");
}

export async function deleteTunnel(id: string): Promise<void> {
  const response = await fetch(`/api/v1/tunnels/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete tunnel");
}
