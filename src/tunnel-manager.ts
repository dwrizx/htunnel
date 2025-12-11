import type {
  TunnelConfig,
  TunnelInstance,
  TunnelProvider as TunnelProviderType,
  CreateTunnelRequest,
} from "./types";
import { getProvider } from "./providers";

class TunnelManager {
  private tunnels = new Map<string, TunnelInstance>();

  private generateId(): string {
    return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  async create(request: CreateTunnelRequest): Promise<TunnelInstance> {
    const id = this.generateId();

    const config: TunnelConfig = {
      id,
      provider: request.provider,
      name: request.name || "Unnamed",
      localPort: request.localPort,
      localHost: request.localHost || "localhost",
      token: request.token,
      pinggyPassword: request.pinggyPassword,
      subdomain: request.subdomain,
      createdAt: new Date(),
    };

    const tunnel: TunnelInstance = {
      config,
      status: "starting",
      urls: [],
      logs: [],
      startedAt: new Date(),
    };

    this.tunnels.set(id, tunnel);

    try {
      const provider = getProvider(request.provider);
      await provider.start(tunnel);
    } catch (error) {
      tunnel.status = "error";
      tunnel.error = error instanceof Error ? error.message : "Unknown error";
    }

    return tunnel;
  }

  async stop(id: string): Promise<boolean> {
    const tunnel = this.tunnels.get(id);
    if (!tunnel) return false;

    try {
      const provider = getProvider(tunnel.config.provider);
      await provider.stop(tunnel);
      return true;
    } catch {
      return false;
    }
  }

  async restart(id: string): Promise<TunnelInstance | undefined> {
    const tunnel = this.tunnels.get(id);
    if (!tunnel) return undefined;

    await this.stop(id);
    
    tunnel.status = "starting";
    tunnel.urls = [];
    tunnel.error = undefined;

    try {
      const provider = getProvider(tunnel.config.provider);
      await provider.start(tunnel);
    } catch (error) {
      tunnel.status = "error";
      tunnel.error = error instanceof Error ? error.message : "Unknown error";
    }

    return tunnel;
  }

  delete(id: string): boolean {
    const tunnel = this.tunnels.get(id);
    if (!tunnel) return false;

    this.stop(id);
    return this.tunnels.delete(id);
  }

  get(id: string): TunnelInstance | undefined {
    return this.tunnels.get(id);
  }

  getAll(): TunnelInstance[] {
    return Array.from(this.tunnels.values());
  }

  async stopAll(): Promise<void> {
    const promises = Array.from(this.tunnels.keys()).map((id) => this.stop(id));
    await Promise.all(promises);
  }

  getLiveTunnels(): TunnelInstance[] {
    return this.getAll().filter((t) => t.status === "live");
  }

  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      live: all.filter((t) => t.status === "live").length,
      error: all.filter((t) => t.status === "error").length,
      closed: all.filter((t) => t.status === "closed").length,
    };
  }
}

export const tunnelManager = new TunnelManager();
