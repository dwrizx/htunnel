export type TunnelProvider = "pinggy" | "cloudflare" | "ngrok" | "localtunnel";

export type TunnelStatus = "starting" | "live" | "closed" | "error";

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
