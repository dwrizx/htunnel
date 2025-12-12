export type TunnelProvider = "pinggy" | "cloudflare" | "ngrok" | "localtunnel";

export type TunnelStatus = "starting" | "live" | "closed" | "error";

export type CloudflareTunnelMode = "quick" | "local" | "token";

export interface TunnelConfig {
  id: string;
  provider: TunnelProvider;
  name: string;
  localPort: number;
  localHost: string;
  token?: string;
  pinggyPassword?: string;
  subdomain?: string;
  createdAt: Date;
  // Cloudflare specific
  cloudflareMode?: CloudflareTunnelMode;
  cloudflareTunnelName?: string; // For local mode - tunnel name
  cloudflareDomain?: string;     // For local mode - your-app.yourdomain.com
}

export interface TunnelInstance {
  config: TunnelConfig;
  status: TunnelStatus;
  urls: string[];
  error?: string;
  process?: ReturnType<typeof Bun.spawn>;
  password?: string;
  extraInfo?: Record<string, string>;
  logs: string[];
  startedAt?: Date;
}

export interface CreateTunnelRequest {
  provider: TunnelProvider;
  name: string;
  localPort: number;
  localHost?: string;
  token?: string;
  pinggyPassword?: string;
  subdomain?: string;
  // Cloudflare specific
  cloudflareMode?: CloudflareTunnelMode;
  cloudflareTunnelName?: string;
  cloudflareDomain?: string;
}

export interface ProviderField {
  name: string;
  label: string;
  placeholder: string;
  type: "text" | "number" | "password";
  required?: boolean;
  helpText?: string;
}

export interface ProviderInfo {
  name: string;
  color: string;
  icon: string;
  description: string;
  features: string[];
  requiresCli?: string;
  requiresAuth?: boolean;
  authField?: ProviderField;
  extraFields?: ProviderField[];
  installCommands?: {
    linux: string;
    macos: string;
    windows?: string;
  };
  docsUrl?: string;
}

export interface ProviderStatus {
  provider: TunnelProvider;
  installed: boolean;
  version?: string;
}
