import type { TunnelProvider as TunnelProviderType } from "../types";
import type { TunnelProvider } from "./base";
import { pinggyProvider } from "./pinggy";
import { cloudflareProvider } from "./cloudflare";
import { ngrokProvider } from "./ngrok";
import { localtunnelProvider } from "./localtunnel";

export const providers: Record<TunnelProviderType, TunnelProvider> = {
  pinggy: pinggyProvider,
  cloudflare: cloudflareProvider,
  ngrok: ngrokProvider,
  localtunnel: localtunnelProvider,
};

export function getProvider(name: TunnelProviderType): TunnelProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

export { type TunnelProvider } from "./base";
