/**
 * Cloudflared Installer Utility
 * =============================
 *
 * Cross-platform installation utility for cloudflared CLI tool.
 * Supports Windows, macOS, and Linux with automatic detection.
 *
 * Features:
 * - Auto-detect platform and architecture
 * - Multiple installation methods per platform
 * - Progress callbacks for UI updates
 * - Automatic skip if already installed
 * - Comprehensive error handling
 *
 * Based on official Cloudflare documentation:
 * @see https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/
 *
 * @module cloudflared-installer
 */

import {
  detectOS,
  getArch,
  detectLinuxDistro,
  type Platform,
  type LinuxDistro,
} from "./cli-checker";

// ============================================================================
// Types
// ============================================================================

export interface InstallResult {
  success: boolean;
  message: string;
  output?: string;
  version?: string;
  skipped?: boolean;
}

export interface InstallProgress {
  step: string;
  progress: number;
  total: number;
  detail?: string;
}

export interface PlatformInfo {
  os: Platform;
  arch: string;
  distro?: LinuxDistro;
  packageManager?: string;
}

export interface DownloadInfo {
  url: string;
  filename: string;
  checksumUrl?: string;
}

export interface InstallMethod {
  name: string;
  available: boolean;
  command: string;
  description: string;
  requiresSudo?: boolean;
}

type ProgressCallback = (progress: InstallProgress) => void;

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Get comprehensive platform information
 */
export async function getPlatformInfo(): Promise<PlatformInfo> {
  const os = detectOS();
  const arch = getArch();

  const info: PlatformInfo = { os, arch };

  if (os === "linux") {
    info.distro = await detectLinuxDistro();
    info.packageManager = await detectPackageManager();
  } else if (os === "macos") {
    info.packageManager = (await checkCommand("brew")) ? "homebrew" : undefined;
  } else if (os === "windows") {
    if (await checkCommand("winget")) {
      info.packageManager = "winget";
    } else if (await checkCommand("choco")) {
      info.packageManager = "chocolatey";
    }
  }

  return info;
}

/**
 * Detect available package manager on Linux
 */
async function detectPackageManager(): Promise<string | undefined> {
  const managers = [
    { cmd: "apt-get", name: "apt" },
    { cmd: "dnf", name: "dnf" },
    { cmd: "yum", name: "yum" },
    { cmd: "pacman", name: "pacman" },
    { cmd: "zypper", name: "zypper" },
    { cmd: "apk", name: "apk" },
  ];

  for (const { cmd, name } of managers) {
    if (await checkCommand(cmd)) {
      return name;
    }
  }
  return undefined;
}

/**
 * Check if a command exists
 */
async function checkCommand(cmd: string): Promise<boolean> {
  const os = detectOS();
  const checkCmd = os === "windows" ? "where" : "which";

  try {
    const proc = Bun.spawn([checkCmd, cmd], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

// ============================================================================
// Installation Status Check
// ============================================================================

/**
 * Check if cloudflared is installed and get version
 */
export async function checkCloudflaredStatus(): Promise<{
  installed: boolean;
  version?: string;
  path?: string;
}> {
  const os = detectOS();

  try {
    // Try different executable names
    const executables =
      os === "windows" ? ["cloudflared.exe", "cloudflared"] : ["cloudflared"];

    for (const exe of executables) {
      try {
        const proc = Bun.spawn([exe, "--version"], {
          stdout: "pipe",
          stderr: "pipe",
        });

        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        if (exitCode === 0) {
          const versionMatch = output.match(
            /cloudflared version (\d+\.\d+\.\d+)/,
          );

          // Get path
          const pathCmd = os === "windows" ? "where" : "which";
          const pathProc = Bun.spawn([pathCmd, exe], {
            stdout: "pipe",
            stderr: "pipe",
          });
          const pathOutput = await new Response(pathProc.stdout).text();

          return {
            installed: true,
            version: versionMatch?.[1],
            path: pathOutput.trim().split("\n")[0],
          };
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Not installed
  }

  return { installed: false };
}

/**
 * Alias for backward compatibility
 */
export async function isCloudflaredInstalled(): Promise<boolean> {
  const status = await checkCloudflaredStatus();
  return status.installed;
}

/**
 * Get cloudflared version (alias for backward compatibility)
 */
export async function getCloudflaredVersion(): Promise<string | null> {
  const status = await checkCloudflaredStatus();
  return status.version ?? null;
}

// ============================================================================
// Download URLs
// ============================================================================

/**
 * Get download URL for cloudflared based on platform
 */
export function getCloudflaredDownloadUrl(
  platformInfo?: PlatformInfo,
): DownloadInfo {
  const os = platformInfo?.os ?? detectOS();
  const arch = platformInfo?.arch ?? getArch();

  const baseUrl =
    "https://github.com/cloudflare/cloudflared/releases/latest/download";

  if (os === "windows") {
    const winArch = arch === "386" ? "386" : "amd64";
    return {
      url: `${baseUrl}/cloudflared-windows-${winArch}.exe`,
      filename: "cloudflared.exe",
      checksumUrl: `${baseUrl}/cloudflared-windows-${winArch}.exe.sha256`,
    };
  }

  if (os === "macos") {
    const macArch = arch === "arm64" ? "arm64" : "amd64";
    return {
      url: `${baseUrl}/cloudflared-darwin-${macArch}.tgz`,
      filename: "cloudflared",
      checksumUrl: `${baseUrl}/cloudflared-darwin-${macArch}.tgz.sha256`,
    };
  }

  // Linux
  return {
    url: `${baseUrl}/cloudflared-linux-${arch}`,
    filename: "cloudflared",
    checksumUrl: `${baseUrl}/cloudflared-linux-${arch}.sha256`,
  };
}

// ============================================================================
// Installation Methods
// ============================================================================

/**
 * Get available installation methods for current platform
 */
export async function getAvailableInstallMethods(): Promise<InstallMethod[]> {
  const info = await getPlatformInfo();
  const methods: InstallMethod[] = [];

  if (info.os === "macos") {
    methods.push({
      name: "homebrew",
      available: info.packageManager === "homebrew",
      command: "brew install cloudflared",
      description: "Install via Homebrew (recommended)",
      requiresSudo: false,
    });
    methods.push({
      name: "binary",
      available: true,
      command: "curl -L <url> | tar xz && sudo mv cloudflared /usr/local/bin/",
      description: "Download binary directly",
      requiresSudo: true,
    });
  } else if (info.os === "windows") {
    methods.push({
      name: "winget",
      available: info.packageManager === "winget",
      command: "winget install --id Cloudflare.cloudflared",
      description: "Install via Windows Package Manager (recommended)",
      requiresSudo: false,
    });
    methods.push({
      name: "chocolatey",
      available: info.packageManager === "chocolatey",
      command: "choco install cloudflared",
      description: "Install via Chocolatey",
      requiresSudo: true,
    });
    methods.push({
      name: "binary",
      available: true,
      command: "Download from GitHub releases",
      description: "Download executable directly",
      requiresSudo: false,
    });
  } else {
    // Linux
    if (info.distro === "debian" || info.packageManager === "apt") {
      methods.push({
        name: "apt",
        available: true,
        command: "sudo apt-get update && sudo apt-get install cloudflared",
        description: "Install via APT (Debian/Ubuntu)",
        requiresSudo: true,
      });
    }
    if (
      info.distro === "rhel" ||
      info.packageManager === "dnf" ||
      info.packageManager === "yum"
    ) {
      methods.push({
        name: "rpm",
        available: true,
        command:
          info.packageManager === "dnf"
            ? "sudo dnf install cloudflared"
            : "sudo yum install cloudflared",
        description: "Install via DNF/YUM (RHEL/Fedora)",
        requiresSudo: true,
      });
    }
    if (info.distro === "arch" || info.packageManager === "pacman") {
      methods.push({
        name: "pacman",
        available: true,
        command: "sudo pacman -S cloudflared",
        description: "Install via Pacman (Arch Linux)",
        requiresSudo: true,
      });
    }
    methods.push({
      name: "binary",
      available: true,
      command:
        "curl -L <url> -o cloudflared && chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/",
      description: "Download binary directly",
      requiresSudo: true,
    });
  }

  return methods;
}

// ============================================================================
// Installation Functions
// ============================================================================

/**
 * Install cloudflared using package manager
 */
export async function installWithPackageManager(
  onProgress?: ProgressCallback,
): Promise<InstallResult> {
  const info = await getPlatformInfo();

  onProgress?.({
    step: "Detecting platform...",
    progress: 1,
    total: 5,
    detail: `${info.os} (${info.arch})`,
  });

  // Check if already installed
  const status = await checkCloudflaredStatus();
  if (status.installed) {
    return {
      success: true,
      message: `cloudflared ${status.version} is already installed`,
      version: status.version,
      skipped: true,
    };
  }

  onProgress?.({ step: "Checking package manager...", progress: 2, total: 5 });

  try {
    let shell: string;
    let args: string[];

    if (info.os === "macos") {
      if (!info.packageManager) {
        return {
          success: false,
          message:
            "Homebrew not found. Please install Homebrew first: https://brew.sh",
        };
      }
      shell = "sh";
      args = ["-c", "brew install cloudflared"];
    } else if (info.os === "windows") {
      if (info.packageManager === "winget") {
        shell = "cmd";
        args = [
          "/c",
          "winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements",
        ];
      } else if (info.packageManager === "chocolatey") {
        shell = "cmd";
        args = ["/c", "choco install cloudflared -y"];
      } else {
        // Fall back to binary download
        return installBinary(onProgress);
      }
    } else {
      // Linux
      if (info.packageManager === "apt") {
        onProgress?.({
          step: "Adding Cloudflare repository...",
          progress: 2,
          total: 5,
        });

        shell = "sh";
        args = [
          "-c",
          `
          sudo mkdir -p --mode=0755 /usr/share/keyrings && \
          curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null && \
          echo "deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list && \
          sudo apt-get update && sudo apt-get install -y cloudflared
        `,
        ];
      } else if (info.packageManager === "dnf") {
        shell = "sh";
        args = [
          "-c",
          `
          curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | sudo tee /etc/yum.repos.d/cloudflared.repo && \
          sudo dnf install -y cloudflared
        `,
        ];
      } else if (info.packageManager === "yum") {
        shell = "sh";
        args = [
          "-c",
          `
          curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | sudo tee /etc/yum.repos.d/cloudflared.repo && \
          sudo yum install -y cloudflared
        `,
        ];
      } else if (info.packageManager === "pacman") {
        shell = "sh";
        args = ["-c", "sudo pacman -Sy --noconfirm cloudflared"];
      } else {
        // No package manager, use binary
        return installBinary(onProgress);
      }
    }

    onProgress?.({ step: "Installing cloudflared...", progress: 3, total: 5 });

    const proc = Bun.spawn([shell, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, _stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;

    onProgress?.({ step: "Verifying installation...", progress: 4, total: 5 });

    if (exitCode !== 0) {
      // Try binary installation as fallback
      onProgress?.({
        step: "Package manager failed, trying binary...",
        progress: 4,
        total: 5,
      });
      return installBinary(onProgress);
    }

    onProgress?.({ step: "Installation complete!", progress: 5, total: 5 });

    const newStatus = await checkCloudflaredStatus();
    return {
      success: true,
      message: `cloudflared ${newStatus.version || "unknown"} installed successfully`,
      version: newStatus.version,
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
export async function installBinary(
  onProgress?: ProgressCallback,
): Promise<InstallResult> {
  const info = await getPlatformInfo();
  const download = getCloudflaredDownloadUrl(info);

  onProgress?.({
    step: "Preparing download...",
    progress: 1,
    total: 5,
    detail: download.url,
  });

  // Check if already installed
  const status = await checkCloudflaredStatus();
  if (status.installed) {
    return {
      success: true,
      message: `cloudflared ${status.version} is already installed`,
      version: status.version,
      skipped: true,
    };
  }

  try {
    if (info.os === "windows") {
      return installBinaryWindows(download, onProgress);
    } else if (info.os === "macos") {
      return installBinaryMacOS(download, onProgress);
    } else {
      return installBinaryLinux(download, onProgress);
    }
  } catch (error) {
    return {
      success: false,
      message: `Installation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Install binary on Windows
 */
async function installBinaryWindows(
  download: DownloadInfo,
  onProgress?: ProgressCallback,
): Promise<InstallResult> {
  const appData =
    process.env.LOCALAPPDATA ||
    process.env.APPDATA ||
    "C:\\Users\\Default\\AppData\\Local";
  const installPath = `${appData}\\cloudflared`;
  const exePath = `${installPath}\\${download.filename}`;

  onProgress?.({
    step: "Downloading cloudflared...",
    progress: 2,
    total: 5,
    detail: installPath,
  });

  const command = `
    $ErrorActionPreference = "Stop"
    if (-not (Test-Path "${installPath}")) { 
      New-Item -ItemType Directory -Path "${installPath}" -Force | Out-Null
    }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "${download.url}" -OutFile "${exePath}" -UseBasicParsing
    
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::User)
    if ($currentPath -notlike "*${installPath}*") {
      [Environment]::SetEnvironmentVariable("PATH", "$currentPath;${installPath}", [EnvironmentVariableTarget]::User)
    }
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  onProgress?.({ step: "Installing to " + installPath, progress: 3, total: 5 });

  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return {
      success: false,
      message: "Download failed",
      output: stderr,
    };
  }

  onProgress?.({ step: "Verifying installation...", progress: 4, total: 5 });

  // Verify by running from full path
  try {
    const verifyProc = Bun.spawn([exePath, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(verifyProc.stdout).text();
    const versionMatch = output.match(/cloudflared version (\d+\.\d+\.\d+)/);

    onProgress?.({ step: "Installation complete!", progress: 5, total: 5 });

    return {
      success: true,
      message: `cloudflared installed to ${installPath}. Please restart your terminal to use it.`,
      version: versionMatch?.[1],
    };
  } catch {
    return {
      success: true,
      message: `cloudflared installed to ${installPath}. Please restart your terminal.`,
    };
  }
}

/**
 * Install binary on macOS
 */
async function installBinaryMacOS(
  download: DownloadInfo,
  onProgress?: ProgressCallback,
): Promise<InstallResult> {
  const installPath = "/usr/local/bin";

  onProgress?.({ step: "Downloading cloudflared...", progress: 2, total: 5 });

  const command = `
    curl -fsSL "${download.url}" -o /tmp/cloudflared.tgz && \
    tar -xzf /tmp/cloudflared.tgz -C /tmp && \
    sudo mv /tmp/cloudflared ${installPath}/cloudflared && \
    sudo chmod +x ${installPath}/cloudflared && \
    rm -f /tmp/cloudflared.tgz
  `;

  const proc = Bun.spawn(["sh", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  onProgress?.({ step: "Installing to " + installPath, progress: 3, total: 5 });

  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return {
      success: false,
      message: "Installation failed. You may need sudo permissions.",
      output: stderr,
    };
  }

  onProgress?.({ step: "Verifying installation...", progress: 4, total: 5 });

  const newStatus = await checkCloudflaredStatus();

  onProgress?.({ step: "Installation complete!", progress: 5, total: 5 });

  return {
    success: true,
    message: `cloudflared ${newStatus.version || ""} installed to ${installPath}`,
    version: newStatus.version,
  };
}

/**
 * Install binary on Linux
 */
async function installBinaryLinux(
  download: DownloadInfo,
  onProgress?: ProgressCallback,
): Promise<InstallResult> {
  const installPath = "/usr/local/bin";

  onProgress?.({ step: "Downloading cloudflared...", progress: 2, total: 5 });

  const command = `
    curl -fsSL "${download.url}" -o /tmp/cloudflared && \
    sudo mv /tmp/cloudflared ${installPath}/cloudflared && \
    sudo chmod +x ${installPath}/cloudflared
  `;

  const proc = Bun.spawn(["sh", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  onProgress?.({ step: "Installing to " + installPath, progress: 3, total: 5 });

  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return {
      success: false,
      message: "Installation failed. You may need sudo permissions.",
      output: stderr,
    };
  }

  onProgress?.({ step: "Verifying installation...", progress: 4, total: 5 });

  const newStatus = await checkCloudflaredStatus();

  onProgress?.({ step: "Installation complete!", progress: 5, total: 5 });

  return {
    success: true,
    message: `cloudflared ${newStatus.version || ""} installed to ${installPath}`,
    version: newStatus.version,
  };
}

// ============================================================================
// Auto Install
// ============================================================================

/**
 * Auto-detect platform and install cloudflared
 * Skips installation if already installed
 */
export async function autoInstall(
  onProgress?: ProgressCallback,
): Promise<InstallResult> {
  onProgress?.({
    step: "Checking installation status...",
    progress: 0,
    total: 5,
  });

  // Check if already installed - skip if so
  const status = await checkCloudflaredStatus();
  if (status.installed) {
    onProgress?.({
      step: "Already installed!",
      progress: 5,
      total: 5,
      detail: `v${status.version}`,
    });
    return {
      success: true,
      message: `cloudflared is already installed (version ${status.version})`,
      version: status.version,
      skipped: true,
    };
  }

  // Try package manager first
  const pmResult = await installWithPackageManager(onProgress);
  if (pmResult.success) {
    return pmResult;
  }

  // Fall back to binary
  return installBinary(onProgress);
}

// ============================================================================
// Install Instructions
// ============================================================================

/**
 * Get human-readable installation instructions
 */
export async function getInstallInstructions(): Promise<{
  platform: Platform;
  arch: string;
  distro?: LinuxDistro;
  preferred: { method: string; command: string; description: string };
  alternative?: { method: string; command: string; description: string };
  manual: string;
  downloadUrl: string;
}> {
  const info = await getPlatformInfo();
  const download = getCloudflaredDownloadUrl(info);

  const docsUrl =
    "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/";

  if (info.os === "macos") {
    return {
      platform: "macos",
      arch: info.arch,
      preferred: {
        method: "Homebrew",
        command: "brew install cloudflared",
        description:
          "Recommended for macOS. Install Homebrew first if not installed: https://brew.sh",
      },
      alternative: {
        method: "Binary",
        command: `curl -L "${download.url}" -o cloudflared.tgz && tar xzf cloudflared.tgz && sudo mv cloudflared /usr/local/bin/`,
        description: "Download and install binary directly",
      },
      manual: docsUrl,
      downloadUrl: download.url,
    };
  }

  if (info.os === "windows") {
    return {
      platform: "windows",
      arch: info.arch,
      preferred: {
        method: "winget",
        command: "winget install --id Cloudflare.cloudflared",
        description: "Windows Package Manager (Windows 10/11)",
      },
      alternative: {
        method: "Chocolatey",
        command: "choco install cloudflared",
        description: "Using Chocolatey package manager",
      },
      manual: docsUrl,
      downloadUrl: download.url,
    };
  }

  // Linux
  let preferred: { method: string; command: string; description: string };

  if (info.distro === "debian" || info.packageManager === "apt") {
    preferred = {
      method: "APT",
      command: `curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null && echo "deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list && sudo apt-get update && sudo apt-get install cloudflared`,
      description: "For Debian, Ubuntu, Linux Mint, and derivatives",
    };
  } else if (
    info.distro === "rhel" ||
    info.packageManager === "dnf" ||
    info.packageManager === "yum"
  ) {
    preferred = {
      method: "DNF/YUM",
      command: `curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | sudo tee /etc/yum.repos.d/cloudflared.repo && sudo ${info.packageManager || "yum"} install cloudflared`,
      description: "For RHEL, CentOS, Fedora, Rocky Linux, and derivatives",
    };
  } else if (info.distro === "arch" || info.packageManager === "pacman") {
    preferred = {
      method: "Pacman",
      command: "sudo pacman -S cloudflared",
      description: "For Arch Linux, Manjaro, and derivatives",
    };
  } else {
    preferred = {
      method: "Binary",
      command: `curl -L "${download.url}" -o cloudflared && chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/`,
      description: "Download binary directly (works on any Linux)",
    };
  }

  return {
    platform: "linux",
    arch: info.arch,
    distro: info.distro,
    preferred,
    alternative: {
      method: "Binary",
      command: `curl -L "${download.url}" -o cloudflared && chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/`,
      description: "Download binary directly",
    },
    manual: docsUrl,
    downloadUrl: download.url,
  };
}
