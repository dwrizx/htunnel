import { Hono } from "hono";
import { tunnelManager } from "../tunnel-manager";
import { layout } from "../views/layout";
import {
  createForm,
  tunnelList,
  statsHeader,
  installModal,
  PROVIDERS,
} from "../views/components";
import { checkAllProviders } from "../utils/cli-checker";

export const webRoutes = new Hono();

webRoutes.get("/", async (c) => {
  const tunnels = tunnelManager.getAll();
  const stats = tunnelManager.getStats();
  const providerStatuses = await checkAllProviders();

  const content = `
    ${createForm(providerStatuses)}
    <div class="bg-dark-800 rounded-2xl p-5 border border-dark-700 shadow-xl shadow-dark-900/50">
      ${statsHeader(stats)}
      <div id="tunnel-list" class="space-y-3" hx-get="/api/tunnels" hx-trigger="every 5s">
        ${tunnelList(tunnels)}
      </div>
    </div>
    ${installModal()}
  `;

  return c.html(layout(content));
});

webRoutes.get("/help", (c) => {
  const helpContent = `
    <div class="bg-dark-800 rounded-2xl p-6 border border-dark-700 shadow-xl shadow-dark-900/50">
      <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg class="size-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Help & Usage
      </h2>
      
      <div class="space-y-6 text-sm">
        <section class="p-4 bg-dark-700/50 rounded-xl">
          <h3 class="font-medium text-violet-400 mb-3 flex items-center gap-2">
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            Quick Start
          </h3>
          <ol class="list-decimal list-inside space-y-2 text-gray-400">
            <li>Select a tunnel provider (look for <span class="text-emerald-400">Ready</span> badge)</li>
            <li>Enter a name for your tunnel</li>
            <li>Set the local port your app is running on</li>
            <li>Click "Create Tunnel"</li>
            <li>Copy the public URL and share it!</li>
          </ol>
        </section>

        <section class="p-4 bg-dark-700/50 rounded-xl">
          <h3 class="font-medium text-violet-400 mb-3 flex items-center gap-2">
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            Providers
          </h3>
          <div class="grid gap-3">
            <div class="flex items-start gap-3 p-3 bg-dark-800 rounded-lg">
              <div class="size-8 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center text-white shrink-0">
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/></svg>
              </div>
              <div>
                <p class="text-white font-medium">Pinggy</p>
                <p class="text-xs text-gray-400">Free, no installation needed. Uses SSH tunneling. Best for quick testing.</p>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-dark-800 rounded-lg">
              <div class="size-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white shrink-0">
                <svg class="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16.309 9.691a2.788 2.788 0 01-2.788-2.788 2.788 2.788 0 012.788-2.788 2.788 2.788 0 012.788 2.788 2.788 2.788 0 01-2.788 2.788z"/></svg>
              </div>
              <div>
                <p class="text-white font-medium">Cloudflare Tunnel</p>
                <p class="text-xs text-gray-400">Requires <code class="bg-dark-600 px-1 rounded">cloudflared</code> CLI. Fast & secure, great for production.</p>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-dark-800 rounded-lg">
              <div class="size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center text-white shrink-0">
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9"/></svg>
              </div>
              <div>
                <p class="text-white font-medium">ngrok</p>
                <p class="text-xs text-gray-400">Requires <code class="bg-dark-600 px-1 rounded">ngrok</code> CLI. Popular & reliable with dashboard at localhost:4040.</p>
              </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-dark-800 rounded-lg">
              <div class="size-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center text-white shrink-0">
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              </div>
              <div>
                <p class="text-white font-medium">Localtunnel</p>
                <p class="text-xs text-gray-400">Uses npx, no installation needed. Supports custom subdomains.</p>
              </div>
            </div>
          </div>
        </section>

        <section class="p-4 bg-dark-700/50 rounded-xl">
          <h3 class="font-medium text-violet-400 mb-3 flex items-center gap-2">
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            CLI Usage
          </h3>
          <pre class="bg-dark-900 p-3 rounded-lg text-xs overflow-x-auto text-gray-300"><span class="text-gray-500"># Start the server</span>
bun run start

<span class="text-gray-500"># Development mode with hot reload</span>
bun run dev

<span class="text-gray-500"># Show help</span>
bun run index.ts --help

<span class="text-gray-500"># Custom port</span>
PORT=8080 bun run start</pre>
        </section>
      </div>
      
      <div class="mt-6 flex gap-3">
        <a href="/" class="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition-colors flex items-center gap-2">
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Back to Dashboard
        </a>
        <a href="/install" class="px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-sm transition-colors flex items-center gap-2">
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Install Providers
        </a>
      </div>
    </div>
  `;

  return c.html(layout(helpContent, "Help - Hades Tunnel"));
});

webRoutes.get("/install", async (c) => {
  const providerStatuses = await checkAllProviders();

  const providerCards = (Object.entries(PROVIDERS) as [string, any][])
    .map(([key, info]) => {
      const status = providerStatuses.find((s) => s.provider === key);
      const isInstalled = status?.installed ?? true;
      const needsInstall = info.requiresCli && !isInstalled;
      const featuresHtml =
        info.features
          ?.map(
            (f: string) =>
              `<span class="px-2 py-0.5 bg-dark-600 rounded text-[10px] text-gray-400">${f}</span>`,
          )
          .join("") || "";

      return `
      <div class="p-4 bg-dark-700/50 rounded-xl ${isInstalled ? "border border-emerald-500/30" : "border border-dark-600"}">
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-3">
            <div class="size-10 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center text-white shadow-lg">${info.icon}</div>
            <div>
              <h3 class="font-medium">${info.name}</h3>
              <p class="text-xs text-gray-500">${info.description}</p>
            </div>
          </div>
          ${
            isInstalled
              ? `
            <span class="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
              <svg class="size-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              Installed ${status?.version ? `v${status.version}` : ""}
            </span>`
              : `
            <span class="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">
              <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              Not Installed
            </span>`
          }
        </div>
        
        <!-- Features -->
        <div class="flex flex-wrap gap-1.5 mb-3">
          ${featuresHtml}
        </div>
        
        <!-- Auth Info -->
        ${
          info.requiresAuth
            ? `
          <div class="mb-3 p-2 bg-violet-500/10 border border-violet-500/20 rounded-lg">
            <div class="flex items-center gap-2">
              <svg class="size-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
              </svg>
              <span class="text-xs text-violet-400">Requires ${info.authField?.label || "authentication"}</span>
            </div>
            ${info.authField?.helpText ? `<p class="text-[10px] text-violet-400/70 mt-1 ml-6">${info.authField.helpText}</p>` : ""}
          </div>
        `
            : ""
        }
        
        ${
          info.requiresCli
            ? `
          <div class="pt-3 border-t border-dark-600">
            <p class="text-xs text-gray-500 mb-2">Required CLI: <code class="bg-dark-800 px-1.5 py-0.5 rounded">${info.requiresCli}</code></p>
            ${
              needsInstall && info.installCommands
                ? `
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-gray-600 uppercase w-12">Linux:</span>
                  <code class="text-[10px] text-gray-400 bg-dark-800 px-2 py-1 rounded flex-1 overflow-x-auto">${info.installCommands.linux}</code>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-gray-600 uppercase w-12">macOS:</span>
                  <code class="text-[10px] text-gray-400 bg-dark-800 px-2 py-1 rounded flex-1 overflow-x-auto">${info.installCommands.macos}</code>
                </div>
                ${
                  info.installCommands.windows
                    ? `
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-gray-600 uppercase w-12">Windows:</span>
                  <code class="text-[10px] text-gray-400 bg-dark-800 px-2 py-1 rounded flex-1 overflow-x-auto">${info.installCommands.windows}</code>
                </div>`
                    : ""
                }
              </div>
              <button onclick="showInstallModal('${key}')" class="mt-3 w-full py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-xs transition-colors flex items-center justify-center gap-2">
                <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Auto Install
              </button>`
                : ""
            }
          </div>`
            : `
          <div class="pt-3 border-t border-dark-600 flex items-center justify-between">
            <p class="text-xs text-gray-500">No installation required</p>
            <span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px]">Ready to use</span>
          </div>`
        }
        
        <!-- Docs Link -->
        ${
          info.docsUrl
            ? `
          <a href="${info.docsUrl}" target="_blank" class="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-violet-400 transition-colors">
            <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            View Documentation
          </a>
        `
            : ""
        }
      </div>
    `;
    })
    .join("");

  const content = `
    <div class="bg-dark-800 rounded-2xl p-6 border border-dark-700 shadow-xl shadow-dark-900/50">
      <h2 class="text-lg font-semibold mb-2 flex items-center gap-2">
        <svg class="size-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Install Providers
      </h2>
      <p class="text-sm text-gray-500 mb-6">Manage your tunnel providers and install required CLI tools</p>
      
      <div class="grid gap-4">
        ${providerCards}
      </div>
      
      <div class="mt-6 flex gap-3">
        <a href="/" class="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition-colors flex items-center gap-2">
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Back to Dashboard
        </a>
        <button onclick="location.reload()" class="px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-sm transition-colors flex items-center gap-2">
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Refresh Status
        </button>
      </div>
    </div>
    ${installModal()}
  `;

  return c.html(layout(content, "Install Providers - Hades Tunnel"));
});
