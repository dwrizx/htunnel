import type { TunnelProvider, ProviderStatus } from "../types";
import { PROVIDERS } from "../views/components";

export type Platform = "linux" | "macos" | "windows";
export type LinuxDistro = "debian" | "rhel" | "arch" | "other";

/**
 * Detect the current operating system
 */
export function detectOS(): Platform {
  const platform = process.platform;
  if (platform === "darwin") return "macos";
  if (platform === "win32") return "windows";
  return "linux";
}

/**
 * Detect Linux distribution (if on Linux)
 */
export async function detectLinuxDistro(): Promise<LinuxDistro> {
  if (detectOS() !== "linux") return "other";

  try {
    // Check /etc/os-release
    const proc = Bun.spawn(["cat", "/etc/os-release"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const lower = output.toLowerCase();

    if (
      lower.includes("debian") ||
      lower.includes("ubuntu") ||
      lower.includes("mint")
    ) {
      return "debian";
    }
    if (
      lower.includes("fedora") ||
      lower.includes("rhel") ||
      lower.includes("centos") ||
      lower.includes("rocky") ||
      lower.includes("alma")
    ) {
      return "rhel";
    }
    if (lower.includes("arch") || lower.includes("manjaro")) {
      return "arch";
    }
  } catch {
    // Ignore errors
  }

  return "other";
}

/**
 * Get CPU architecture
 */
export function getArch(): string {
  const arch = process.arch;
  const archMap: Record<string, string> = {
    x64: "amd64",
    arm64: "arm64",
    arm: "arm",
    ia32: "386",
  };
  return archMap[arch] || "amd64";
}

/**
 * Check if a CLI tool is installed
 */
export async function checkCliInstalled(
  cli: string,
): Promise<{ installed: boolean; version?: string }> {
  const os = detectOS();

  // Adjust command for Windows
  let command: string[];
  if (os === "windows") {
    // Try with .exe extension first, then without
    command = [cli + ".exe", "--version"];
  } else {
    command = [cli, "--version"];
  }

  try {
    let proc = Bun.spawn(command, {
      stdout: "pipe",
      stderr: "pipe",
    });

    let output = await new Response(proc.stdout).text();
    let exitCode = await proc.exited;

    // If failed on Windows with .exe, try without
    if (exitCode !== 0 && os === "windows") {
      proc = Bun.spawn([cli, "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      output = await new Response(proc.stdout).text();
      exitCode = await proc.exited;
    }

    if (exitCode === 0) {
      const versionMatch = output.match(/(\d+\.\d+(?:\.\d+)?)/);
      return { installed: true, version: versionMatch?.[1] };
    }
    return { installed: false };
  } catch {
    return { installed: false };
  }
}

/**
 * Check if a command exists using 'which' (Unix) or 'where' (Windows)
 */
export async function commandExists(cmd: string): Promise<boolean> {
  const os = detectOS();
  const checkCmd = os === "windows" ? "where" : "which";

  try {
    const proc = Bun.spawn([checkCmd, cmd], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Check all providers for CLI availability
 */
export async function checkAllProviders(): Promise<ProviderStatus[]> {
  const providers: TunnelProvider[] = [
    "pinggy",
    "cloudflare",
    "ngrok",
    "localtunnel",
  ];
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

/**
 * Get installation command for a provider
 */
export function getInstallCommand(
  provider: TunnelProvider,
): { linux: string; macos: string; windows?: string } | null {
  const info = PROVIDERS[provider];
  return info.installCommands ?? null;
}

/**
 * Get detailed install commands based on platform
 */
export async function getDetailedInstallCommands(
  provider: TunnelProvider,
): Promise<{
  platform: Platform;
  distro?: LinuxDistro;
  commands: string[];
  description: string;
}> {
  const os = detectOS();
  const info = PROVIDERS[provider];

  if (!info.installCommands) {
    return {
      platform: os,
      commands: [],
      description: "No installation required",
    };
  }

  if (os === "macos") {
    return {
      platform: "macos",
      commands: info.installCommands.macos.split(" && "),
      description: "Install using Homebrew",
    };
  }

  if (os === "windows") {
    return {
      platform: "windows",
      commands: (info.installCommands.windows || "")
        .split(" && ")
        .filter(Boolean),
      description: "Install using winget or Chocolatey",
    };
  }

  // Linux - detect distro for better commands
  const distro = await detectLinuxDistro();

  return {
    platform: "linux",
    distro,
    commands: info.installCommands.linux.split(" && "),
    description: `Install on Linux (${distro})`,
  };
}

/**
 * Run installation command for a provider
 */
export async function runInstallCommand(
  provider: TunnelProvider,
): Promise<{ success: boolean; output: string }> {
  const commands = getInstallCommand(provider);
  const os = detectOS();

  if (!commands) {
    return {
      success: false,
      output: "No install command available for this provider",
    };
  }

  const command = commands[os];
  if (!command) {
    return { success: false, output: `No install command available for ${os}` };
  }

  try {
    let proc;

    if (os === "windows") {
      // Use cmd.exe on Windows
      proc = Bun.spawn(["cmd", "/c", command], {
        stdout: "pipe",
        stderr: "pipe",
      });
    } else {
      // Use sh on Unix-like systems
      proc = Bun.spawn(["sh", "-c", command], {
        stdout: "pipe",
        stderr: "pipe",
      });
    }

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

/**
 * Get download URL for cloudflared based on platform
 */
export function getCloudflaredDownloadUrl(): string {
  const os = detectOS();
  const arch = getArch();

  const baseUrl =
    "https://github.com/cloudflare/cloudflared/releases/latest/download";

  if (os === "macos") {
    return arch === "arm64"
      ? `${baseUrl}/cloudflared-darwin-arm64.tgz`
      : `${baseUrl}/cloudflared-darwin-amd64.tgz`;
  }

  if (os === "windows") {
    return arch === "386"
      ? `${baseUrl}/cloudflared-windows-386.exe`
      : `${baseUrl}/cloudflared-windows-amd64.exe`;
  }

  // Linux
  return `${baseUrl}/cloudflared-linux-${arch}`;
}

/**
 * Get ngrok download URL based on platform
 */
export function getNgrokDownloadUrl(): string {
  const os = detectOS();
  const arch = getArch();

  const baseUrl = "https://bin.equinox.io/c/bNyj1mQVY4c";

  const archMap: Record<string, string> = {
    amd64: "amd64",
    arm64: "arm64",
    arm: "arm",
    "386": "386",
  };

  const ngrokArch = archMap[arch] || "amd64";

  if (os === "macos") {
    return `${baseUrl}/ngrok-v3-stable-darwin-${ngrokArch}.zip`;
  }

  if (os === "windows") {
    return `${baseUrl}/ngrok-v3-stable-windows-${ngrokArch}.zip`;
  }

  return `${baseUrl}/ngrok-v3-stable-linux-${ngrokArch}.tgz`;
}
