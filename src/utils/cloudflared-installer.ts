/**
 * Cloudflared Installer Utility
 * 
 * Provides automated installation of cloudflared CLI tool across
 * Windows, macOS, and Linux platforms.
 * 
 * Based on official Cloudflare documentation:
 * https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/
 */

import { detectOS, getArch, type Platform } from "./cli-checker";

export interface InstallResult {
  success: boolean;
  message: string;
  output?: string;
  version?: string;
}

export interface InstallProgress {
  step: string;
  progress: number;
  total: number;
}

type ProgressCallback = (progress: InstallProgress) => void;

/**
 * Get the download URL for cloudflared based on platform and architecture
 */
export function getCloudflaredDownloadUrl(): { url: string; filename: string } {
  const os = detectOS();
  const arch = getArch();
  const baseUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download";

  if (os === "windows") {
    const winArch = arch === "386" ? "386" : "amd64";
    return {
      url: `${baseUrl}/cloudflared-windows-${winArch}.exe`,
      filename: "cloudflared.exe",
    };
  }

  if (os === "macos") {
    const macArch = arch === "arm64" ? "arm64" : "amd64";
    return {
      url: `${baseUrl}/cloudflared-darwin-${macArch}.tgz`,
      filename: "cloudflared",
    };
  }

  // Linux
  return {
    url: `${baseUrl}/cloudflared-linux-${arch}`,
    filename: "cloudflared",
  };
}

/**
 * Install cloudflared using package manager (preferred method)
 */
export async function installWithPackageManager(
  onProgress?: ProgressCallback
): Promise<InstallResult> {
  const os = detectOS();

  onProgress?.({ step: "Detecting platform...", progress: 1, total: 4 });

  try {
    let command: string[];
    let shell: string;

    if (os === "macos") {
      // Check if Homebrew is installed
      const brewCheck = Bun.spawn(["which", "brew"], { stdout: "pipe", stderr: "pipe" });
      if ((await brewCheck.exited) !== 0) {
        return {
          success: false,
          message: "Homebrew not found. Please install Homebrew first: https://brew.sh",
        };
      }

      onProgress?.({ step: "Installing via Homebrew...", progress: 2, total: 4 });
      shell = "sh";
      command = ["-c", "brew install cloudflared"];
    } else if (os === "windows") {
      // Check if winget is available
      const wingetCheck = Bun.spawn(["where", "winget"], { stdout: "pipe", stderr: "pipe" });
      if ((await wingetCheck.exited) !== 0) {
        return {
          success: false,
          message: "winget not found. Please use Windows 10/11 with App Installer or download manually.",
        };
      }

      onProgress?.({ step: "Installing via winget...", progress: 2, total: 4 });
      shell = "cmd";
      command = ["/c", "winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements"];
    } else {
      // Linux - try apt first, then fall back to binary
      const aptCheck = Bun.spawn(["which", "apt-get"], { stdout: "pipe", stderr: "pipe" });
      
      if ((await aptCheck.exited) === 0) {
        onProgress?.({ step: "Installing via apt...", progress: 2, total: 4 });
        shell = "sh";
        command = [
          "-c",
          `sudo mkdir -p --mode=0755 /usr/share/keyrings && ` +
          `curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null && ` +
          `echo "deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list && ` +
          `sudo apt-get update && sudo apt-get install -y cloudflared`,
        ];
      } else {
        // Fall back to binary installation
        return installBinary(onProgress);
      }
    }

    const proc = Bun.spawn([shell, ...command], {
      stdout: "pipe",
      stderr: "pipe",
    });

    onProgress?.({ step: "Running installation...", progress: 3, total: 4 });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      return {
        success: false,
        message: "Installation failed",
        output: stderr || stdout,
      };
    }

    onProgress?.({ step: "Verifying installation...", progress: 4, total: 4 });

    // Verify installation
    const version = await getCloudflaredVersion();
    if (version) {
      return {
        success: true,
        message: `cloudflared ${version} installed successfully`,
        version,
      };
    }

    return {
      success: true,
      message: "Installation completed, but version check failed",
      output: stdout,
    };
  } catch (error) {
    return {
      success: false,
      message: `Installation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Install cloudflared by downloading binary directly
 */
export async function installBinary(onProgress?: ProgressCallback): Promise<InstallResult> {
  const os = detectOS();
  const { url, filename } = getCloudflaredDownloadUrl();

  onProgress?.({ step: "Downloading cloudflared...", progress: 1, total: 4 });

  try {
    let installPath: string;
    let command: string;

    if (os === "windows") {
      // Download to user's local AppData
      const appData = process.env.LOCALAPPDATA || process.env.APPDATA || "C:\\Users\\Default\\AppData\\Local";
      installPath = `${appData}\\cloudflared`;
      
      command = `
        if (-not (Test-Path "${installPath}")) { New-Item -ItemType Directory -Path "${installPath}" }
        Invoke-WebRequest -Uri "${url}" -OutFile "${installPath}\\${filename}"
        $env:PATH += ";${installPath}"
        [Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";${installPath}", [EnvironmentVariableTarget]::User)
      `;
      
      const proc = Bun.spawn(["powershell", "-Command", command], {
        stdout: "pipe",
        stderr: "pipe",
      });

      onProgress?.({ step: "Installing to " + installPath, progress: 2, total: 4 });

      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        return {
          success: false,
          message: "Download failed",
          output: stderr,
        };
      }
    } else {
      // Unix-like systems
      installPath = "/usr/local/bin";
      
      if (os === "macos" && url.endsWith(".tgz")) {
        // macOS uses tgz
        command = `
          curl -L "${url}" -o /tmp/cloudflared.tgz && \
          tar -xzf /tmp/cloudflared.tgz -C /tmp && \
          sudo mv /tmp/cloudflared ${installPath}/cloudflared && \
          sudo chmod +x ${installPath}/cloudflared && \
          rm /tmp/cloudflared.tgz
        `;
      } else {
        // Linux binary
        command = `
          curl -L "${url}" -o /tmp/cloudflared && \
          sudo mv /tmp/cloudflared ${installPath}/cloudflared && \
          sudo chmod +x ${installPath}/cloudflared
        `;
      }

      onProgress?.({ step: "Installing to " + installPath, progress: 2, total: 4 });

      const proc = Bun.spawn(["sh", "-c", command], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        return {
          success: false,
          message: "Installation failed. You may need sudo permissions.",
          output: stderr,
        };
      }
    }

    onProgress?.({ step: "Verifying installation...", progress: 4, total: 4 });

    // Verify
    const version = await getCloudflaredVersion();
    if (version) {
      return {
        success: true,
        message: `cloudflared ${version} installed to ${installPath}`,
        version,
      };
    }

    return {
      success: true,
      message: `Installed to ${installPath}. You may need to restart your terminal.`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Installation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get cloudflared version
 */
export async function getCloudflaredVersion(): Promise<string | null> {
  try {
    const proc = Bun.spawn(["cloudflared", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      const match = output.match(/cloudflared version (\d+\.\d+\.\d+)/);
      return match?.[1] ?? null;
    }
  } catch {
    // Not installed
  }
  return null;
}

/**
 * Check if cloudflared is installed
 */
export async function isCloudflaredInstalled(): Promise<boolean> {
  return (await getCloudflaredVersion()) !== null;
}

/**
 * Get installation instructions for the current platform
 */
export function getInstallInstructions(): {
  platform: Platform;
  preferred: { method: string; command: string };
  alternative: { method: string; command: string } | null;
  manual: string;
} {
  const os = detectOS();

  if (os === "macos") {
    return {
      platform: "macos",
      preferred: {
        method: "Homebrew",
        command: "brew install cloudflared",
      },
      alternative: null,
      manual: "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/",
    };
  }

  if (os === "windows") {
    return {
      platform: "windows",
      preferred: {
        method: "winget",
        command: "winget install --id Cloudflare.cloudflared",
      },
      alternative: {
        method: "Chocolatey",
        command: "choco install cloudflared",
      },
      manual: "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/",
    };
  }

  // Linux
  return {
    platform: "linux",
    preferred: {
      method: "APT (Debian/Ubuntu)",
      command: "sudo apt-get update && sudo apt-get install cloudflared",
    },
    alternative: {
      method: "Binary",
      command: "curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared && chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/",
    },
    manual: "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/",
  };
}

/**
 * Auto-detect and run the best installation method
 */
export async function autoInstall(onProgress?: ProgressCallback): Promise<InstallResult> {
  // First check if already installed
  if (await isCloudflaredInstalled()) {
    const version = await getCloudflaredVersion();
    return {
      success: true,
      message: `cloudflared is already installed (version ${version})`,
      version: version ?? undefined,
    };
  }

  // Try package manager first
  const pmResult = await installWithPackageManager(onProgress);
  if (pmResult.success) {
    return pmResult;
  }

  // Fall back to binary installation
  return installBinary(onProgress);
}


