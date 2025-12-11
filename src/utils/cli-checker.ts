import type { TunnelProvider, ProviderStatus } from "../types";
import { PROVIDERS } from "../views/components";

export async function checkCliInstalled(cli: string): Promise<{ installed: boolean; version?: string }> {
  try {
    const proc = Bun.spawn([cli, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    
    if (exitCode === 0) {
      const versionMatch = output.match(/(\d+\.\d+(?:\.\d+)?)/);
      return { installed: true, version: versionMatch?.[1] };
    }
    return { installed: false };
  } catch {
    return { installed: false };
  }
}

export async function checkAllProviders(): Promise<ProviderStatus[]> {
  const providers: TunnelProvider[] = ["pinggy", "cloudflare", "ngrok", "localtunnel"];
  const results: ProviderStatus[] = [];

  for (const provider of providers) {
    const info = PROVIDERS[provider];
    
    if (info.requiresCli) {
      const { installed, version } = await checkCliInstalled(info.requiresCli);
      results.push({ provider, installed, version });
    } else {
      results.push({ provider, installed: true });
    }
  }

  return results;
}

export function getInstallCommand(provider: TunnelProvider): { linux: string; macos: string; windows?: string } | null {
  const info = PROVIDERS[provider];
  return info.installCommands ?? null;
}

export function detectOS(): "linux" | "macos" | "windows" {
  const platform = process.platform;
  if (platform === "darwin") return "macos";
  if (platform === "win32") return "windows";
  return "linux";
}

export async function runInstallCommand(provider: TunnelProvider): Promise<{ success: boolean; output: string }> {
  const commands = getInstallCommand(provider);
  const os = detectOS();
  
  if (!commands) {
    return { success: false, output: "No install command available for this provider" };
  }

  const command = commands[os];
  if (!command) {
    return { success: false, output: `No install command available for ${os}` };
  }

  try {
    const proc = Bun.spawn(["sh", "-c", command], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    
    const exitCode = await proc.exited;
    const output = stdout + (stderr ? `\n${stderr}` : "");
    
    return { success: exitCode === 0, output };
  } catch (error) {
    return { success: false, output: String(error) };
  }
}
