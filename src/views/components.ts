import type { TunnelInstance, TunnelProvider, ProviderInfo, ProviderStatus } from "../types";

// Helper functions
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatLogs(logs: string[]): string {
  if (!logs || logs.length === 0) return '<span class="text-gray-600">Waiting for output...</span>';
  return logs.map(log => {
    if (log.startsWith('$')) {
      return `<div class="text-emerald-400">${escapeHtml(log)}</div>`;
    } else if (log.startsWith('ERROR')) {
      return `<div class="text-red-400">${escapeHtml(log)}</div>`;
    } else if (log.startsWith('URL:')) {
      return `<div class="text-violet-400">${escapeHtml(log)}</div>`;
    } else if (log.includes('established') || log.includes('successfully')) {
      return `<div class="text-emerald-400">${escapeHtml(log)}</div>`;
    } else {
      return `<div class="text-gray-400">${escapeHtml(log)}</div>`;
    }
  }).join('');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatLogsHtml(logs: string[]): string {
  return formatLogs(logs);
}

export const PROVIDERS: Record<TunnelProvider, ProviderInfo> = {
  pinggy: {
    name: "Pinggy",
    color: "from-sky-500 to-cyan-400",
    icon: `<svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/></svg>`,
    description: "Free SSH tunnel, Pro for persistent URLs",
    features: ["No installation", "Free tier", "Pro: persistent URL", "SSH-based"],
    requiresAuth: false,
    authField: {
      name: "token",
      label: "Pinggy Pro Token",
      placeholder: "e.g. BRh2qz1Xm6z (leave empty for free)",
      type: "text",
      required: false,
      helpText: "Token from dashboard.pinggy.io (or set PINGGY_TOKEN in .env)"
    },
    extraFields: [
      {
        name: "pinggyPassword",
        label: "Pinggy Pro Password",
        placeholder: "Your Pinggy password",
        type: "password",
        required: false,
        helpText: "Password from dashboard.pinggy.io (or set PINGGY_PASSWORD in .env)"
      }
    ],
    docsUrl: "https://pinggy.io/docs/",
  },
  cloudflare: {
    name: "Cloudflare Tunnel",
    color: "from-orange-500 to-amber-400",
    icon: `<svg class="size-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.2678-.2246-.2793-.5732-.4268-.9834-.4473l-8.1572-.1123c-.0654-.0039-.1123-.0215-.1416-.0537-.0283-.0303-.0381-.0703-.0263-.1113.0205-.0703.0859-.127.1533-.127l8.2666-.1132c.8809-.0303 1.8027-.752 2.0889-1.6455l.3496-1.0898c.0146-.0478.0146-.0957.0156-.1435.0019-.0429-.0117-.085-.0166-.127-.4482-2.9297-3.0313-5.166-6.1621-5.166-3.457 0-6.2676 2.8008-6.2676 6.2568 0 .1983.0234.3925.0361.5878-.7832-.0303-1.5039.2442-2.0566.7569-.5908.5489-.9316 1.3291-.9316 2.1308 0 .1221.0088.2432.0254.3633h.0039c.0058.0322.0205.0634.0459.0868l.084.0732h13.0459c.0771 0 .1484-.0527.1699-.127l.2686-.8584z"/></svg>`,
    description: "Enterprise-grade tunnels with 3 modes",
    features: ["Quick tunnel", "Local tunnel", "Token tunnel", "DDoS protection"],
    requiresCli: "cloudflared",
    requiresAuth: false,
    authField: {
      name: "cloudflareMode",
      label: "Tunnel Mode",
      placeholder: "Select tunnel mode",
      type: "text",
      required: false,
      helpText: "Quick: instant temporary URL | Local: persistent with your domain | Token: managed via Dashboard"
    },
    extraFields: [
      {
        name: "token",
        label: "Tunnel Token (for Token mode)",
        placeholder: "eyJhIjoiNzI0NGQ1NTg5NDdiZTJmY2Y5ZGJlMmY5NGNiNmY1ZDIi...",
        type: "password",
        required: false,
        helpText: "Get from Cloudflare Zero Trust Dashboard → Networks → Tunnels → Create → Cloudflared connector"
      },
      {
        name: "cloudflareTunnelName",
        label: "Tunnel Name (for Local mode)",
        placeholder: "my-app-tunnel",
        type: "text",
        required: false,
        helpText: "Persistent tunnel name for local mode. Will create if doesn't exist."
      },
      {
        name: "cloudflareDomain",
        label: "Domain (for Local mode)",
        placeholder: "app.yourdomain.com",
        type: "text",
        required: false,
        helpText: "Your domain (must be registered in Cloudflare). Leave empty for cfargotunnel.com subdomain."
      }
    ],
    installCommands: {
      linux: "curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared && chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/",
      macos: "brew install cloudflared",
      windows: "winget install --id Cloudflare.cloudflared",
    },
    docsUrl: "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/",
  },
  ngrok: {
    name: "ngrok",
    color: "from-emerald-500 to-green-400",
    icon: `<svg class="size-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
    description: "Most popular, with web inspector dashboard",
    features: ["Web inspector", "Replay requests", "Request history", "localhost:4040"],
    requiresCli: "ngrok",
    requiresAuth: true,
    authField: {
      name: "token",
      label: "Authtoken",
      placeholder: "Get from dashboard.ngrok.com/get-started/your-authtoken",
      type: "password",
      required: false,
      helpText: "Get free authtoken from ngrok.com (or set NGROK_AUTHTOKEN in .env). Saved to browser."
    },
    installCommands: {
      linux: "curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo 'deb https://ngrok-agent.s3.amazonaws.com buster main' | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok",
      macos: "brew install ngrok/ngrok/ngrok",
      windows: "choco install ngrok",
    },
    docsUrl: "https://ngrok.com/docs/getting-started/",
  },
  localtunnel: {
    name: "Localtunnel",
    color: "from-violet-500 to-purple-400",
    icon: `<svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>`,
    description: "Free tunnel with auto-detected password",
    features: ["No installation", "Custom subdomain", "Auto password", "Via npx"],
    requiresAuth: false,
    extraFields: [
      {
        name: "subdomain",
        label: "Custom Subdomain",
        placeholder: "my-app",
        type: "text",
        required: false,
        helpText: "Your tunnel will be at: my-app.loca.lt (password auto-detected)"
      }
    ],
    docsUrl: "https://github.com/localtunnel/localtunnel",
  },
};

export function createForm(providerStatuses: ProviderStatus[]): string {
  const statusMap = new Map(providerStatuses.map(s => [s.provider, s]));
  
  const providerOptions = (Object.entries(PROVIDERS) as [TunnelProvider, ProviderInfo][])
    .map(([key, info], i) => {
      const status = statusMap.get(key);
      const isInstalled = status?.installed ?? true;
      const needsInstall = info.requiresCli && !isInstalled;
      
      return `
      <label class="provider-card cursor-pointer group relative" data-provider="${key}" data-installed="${isInstalled}" onclick="selectProvider('${key}')">
        <input type="radio" name="provider" value="${key}" class="peer sr-only" ${i === 0 ? "checked" : ""} ${needsInstall ? 'data-needs-install="true"' : ''}>
        <div class="p-3 rounded-xl bg-dark-800 border-2 border-dark-700 peer-checked:border-violet-500 peer-checked:bg-dark-700/50 transition-all ${needsInstall ? 'opacity-60' : ''}">
          <div class="flex items-start justify-between mb-2">
            <div class="size-9 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center text-white shadow-lg">${info.icon}</div>
            ${isInstalled ? `
              <span class="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/20 text-emerald-400">
                <svg class="size-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                Ready
              </span>` : `
              <span class="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-400">
                <svg class="size-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                Install
              </span>`}
          </div>
          <p class="font-medium text-sm">${info.name}</p>
          <p class="text-[10px] text-gray-500 line-clamp-2">${info.description}</p>
          ${status?.version ? `<p class="text-[9px] text-gray-600 mt-1">v${status.version}</p>` : ''}
        </div>
        ${needsInstall ? `
          <button type="button" onclick="event.preventDefault(); event.stopPropagation(); showInstallModal('${key}')" 
            class="absolute inset-0 flex items-center justify-center bg-dark-900/80 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="px-3 py-1.5 bg-violet-500 rounded-lg text-xs font-medium">Install ${info.name}</span>
          </button>` : ''}
      </label>
    `}).join("");

  const providersDataJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(PROVIDERS).map(([k, v]) => [k, { 
        name: v.name, 
        features: v.features,
        requiresAuth: v.requiresAuth,
        authField: v.authField,
        extraFields: v.extraFields,
        docsUrl: v.docsUrl
      }])
    )
  );

  return `
    <div class="bg-dark-800 rounded-2xl p-5 mb-6 border border-dark-700 shadow-xl shadow-dark-900/50">
      <h2 class="text-base font-semibold mb-4 flex items-center gap-2">
        <svg class="size-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        New Tunnel
      </h2>
      <form hx-post="/api/tunnels" hx-target="#tunnel-list" hx-swap="afterbegin" hx-indicator="#spinner" id="tunnel-form">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">${providerOptions}</div>
        
        <!-- Provider Info Panel -->
        <div id="provider-info" class="mb-4 p-3 bg-dark-700/30 border border-dark-600 rounded-xl">
          <div class="flex items-center justify-between mb-2">
            <span id="provider-name" class="text-sm font-medium text-violet-400">Pinggy</span>
            <a id="provider-docs" href="https://pinggy.io/docs/" target="_blank" class="text-[10px] text-gray-500 hover:text-violet-400 flex items-center gap-1">
              <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              Docs
            </a>
          </div>
          <div id="provider-features" class="flex flex-wrap gap-1.5">
            <span class="px-2 py-0.5 bg-dark-600 rounded text-[10px] text-gray-400">No installation</span>
            <span class="px-2 py-0.5 bg-dark-600 rounded text-[10px] text-gray-400">No signup</span>
            <span class="px-2 py-0.5 bg-dark-600 rounded text-[10px] text-gray-400">Free tier</span>
            <span class="px-2 py-0.5 bg-dark-600 rounded text-[10px] text-gray-400">SSH-based</span>
          </div>
        </div>
        
        <div id="install-warning" class="hidden mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div class="flex items-start gap-2">
            <svg class="size-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <div>
              <p class="text-sm text-amber-200 font-medium">CLI not installed</p>
              <p class="text-xs text-amber-400/80 mt-0.5">This provider requires a CLI tool. Click "Install" on the provider card or use an installed provider.</p>
            </div>
          </div>
        </div>
        
        <!-- Basic Fields -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Tunnel Name <span class="text-red-400">*</span></label>
            <input type="text" name="name" required placeholder="my-tunnel" class="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all">
          </div>
          <div>
            <label class="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Local Port <span class="text-red-400">*</span></label>
            <input type="number" name="localPort" required placeholder="3000" value="3000" class="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all">
          </div>
        </div>
        
        <div class="mb-3">
          <label class="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Host</label>
          <input type="text" name="localHost" placeholder="localhost" value="localhost" class="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all">
        </div>
        
        <!-- Dynamic Provider Fields -->
        <div id="dynamic-fields" class="space-y-3 mb-4">
          <!-- Will be populated by JS based on selected provider -->
        </div>
        
        <button type="submit" id="submit-btn" class="w-full py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-xl font-medium text-sm hover:opacity-90 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98]">
          <span id="spinner" class="htmx-indicator"><svg class="animate-spin size-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></span>
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Create Tunnel
        </button>
      </form>
    </div>
    
    <script>
      const PROVIDER_DATA = ${providersDataJson};
      
      function selectProvider(provider) {
        const data = PROVIDER_DATA[provider];
        if (!data) return;
        
        // Update provider info panel
        document.getElementById('provider-name').textContent = data.name;
        document.getElementById('provider-docs').href = data.docsUrl || '#';
        
        // Update features
        const featuresEl = document.getElementById('provider-features');
        featuresEl.innerHTML = data.features.map(f => 
          '<span class="px-2 py-0.5 bg-dark-600 rounded text-[10px] text-gray-400">' + f + '</span>'
        ).join('');
        
        // Update dynamic fields
        const dynamicFields = document.getElementById('dynamic-fields');
        let fieldsHtml = '';
        
        // Special handling for Cloudflare - add mode selector
        if (provider === 'cloudflare') {
          fieldsHtml += \`
            <div>
              <label class="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Tunnel Mode</label>
              <div class="grid grid-cols-3 gap-2 mb-3">
                <label class="cursor-pointer">
                  <input type="radio" name="cloudflareMode" value="quick" class="sr-only peer" checked onchange="updateCloudflareFields('quick')">
                  <div class="p-2 text-center rounded-lg border-2 border-dark-600 bg-dark-700/50 peer-checked:border-violet-500 peer-checked:bg-violet-500/10 transition-all">
                    <div class="text-sm font-medium">Quick</div>
                    <div class="text-[9px] text-gray-500">Instant temp URL</div>
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="cloudflareMode" value="local" class="sr-only peer" onchange="updateCloudflareFields('local')">
                  <div class="p-2 text-center rounded-lg border-2 border-dark-600 bg-dark-700/50 peer-checked:border-violet-500 peer-checked:bg-violet-500/10 transition-all">
                    <div class="text-sm font-medium">Local</div>
                    <div class="text-[9px] text-gray-500">Your domain</div>
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="cloudflareMode" value="token" class="sr-only peer" onchange="updateCloudflareFields('token')">
                  <div class="p-2 text-center rounded-lg border-2 border-dark-600 bg-dark-700/50 peer-checked:border-violet-500 peer-checked:bg-violet-500/10 transition-all">
                    <div class="text-sm font-medium">Token</div>
                    <div class="text-[9px] text-gray-500">Dashboard managed</div>
                  </div>
                </label>
              </div>
              <div id="cloudflare-mode-info" class="p-2 bg-dark-700/30 rounded-lg border border-dark-600">
                <p class="text-[10px] text-gray-400">Quick tunnel creates an instant temporary URL on trycloudflare.com. No setup required!</p>
              </div>
            </div>
            <div id="cloudflare-fields"></div>
          \`;
        } else {
          // Auth field for other providers
          if (data.authField) {
            const af = data.authField;
            const storageKey = 'hades_' + provider + '_' + af.name;
            const savedValue = localStorage.getItem(storageKey) || '';
            fieldsHtml += \`
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-[10px] text-gray-500 uppercase tracking-wider">
                    \${af.label} \${af.required ? '<span class="text-red-400">*</span>' : '<span class="text-gray-600">(optional)</span>'}
                  </label>
                  <label class="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                    <input type="checkbox" id="save-\${af.name}" class="size-3 rounded" \${savedValue ? 'checked' : ''}>
                    Save to browser
                  </label>
                </div>
                <input type="\${af.type}" name="\${af.name}" id="field-\${af.name}" placeholder="\${af.placeholder}" \${af.required ? 'required' : ''} 
                  value="\${savedValue}"
                  class="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                  onchange="handleFieldSave('\${provider}', '\${af.name}', this.value)">
                \${savedValue ? '<p class="text-[10px] text-emerald-400 mt-1">Loaded from browser storage</p>' : (af.helpText ? '<p class="text-[10px] text-gray-600 mt-1">' + af.helpText + '</p>' : '')}
              </div>
            \`;
          }
          
          // Extra fields
          if (data.extraFields) {
            data.extraFields.forEach(ef => {
              const storageKey = 'hades_' + provider + '_' + ef.name;
              const savedValue = localStorage.getItem(storageKey) || '';
              fieldsHtml += \`
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="block text-[10px] text-gray-500 uppercase tracking-wider">
                      \${ef.label} \${ef.required ? '<span class="text-red-400">*</span>' : '<span class="text-gray-600">(optional)</span>'}
                    </label>
                    <label class="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                      <input type="checkbox" id="save-\${ef.name}" class="size-3 rounded" \${savedValue ? 'checked' : ''}>
                      Save to browser
                    </label>
                  </div>
                  <input type="\${ef.type}" name="\${ef.name}" id="field-\${ef.name}" placeholder="\${ef.placeholder}" \${ef.required ? 'required' : ''} 
                    value="\${savedValue}"
                    class="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                    onchange="handleFieldSave('\${provider}', '\${ef.name}', this.value)">
                  \${savedValue ? '<p class="text-[10px] text-emerald-400 mt-1">Loaded from browser storage</p>' : (ef.helpText ? '<p class="text-[10px] text-gray-600 mt-1">' + ef.helpText + '</p>' : '')}
                </div>
              \`;
            });
          }
        }
        
        dynamicFields.innerHTML = fieldsHtml;
        
        // Check install warning
        const card = document.querySelector('[data-provider="' + provider + '"]');
        const needsInstall = card?.querySelector('input')?.dataset.needsInstall === 'true';
        const warning = document.getElementById('install-warning');
        if (needsInstall) {
          warning?.classList.remove('hidden');
        } else {
          warning?.classList.add('hidden');
        }
      }
      
      // Cloudflare mode field update
      function updateCloudflareFields(mode) {
        const cfFields = document.getElementById('cloudflare-fields');
        const cfInfo = document.getElementById('cloudflare-mode-info');
        
        const modeInfo = {
          quick: 'Quick tunnel creates an instant temporary URL on trycloudflare.com. No setup required!',
          local: 'Local tunnel uses locally-stored credentials. Will create a persistent tunnel with your domain. Requires cloudflared login on first use.',
          token: 'Token tunnel uses a pre-configured token from Cloudflare Zero Trust Dashboard. URL is managed in the dashboard.'
        };
        
        if (cfInfo) {
          cfInfo.innerHTML = '<p class="text-[10px] text-gray-400">' + modeInfo[mode] + '</p>';
        }
        
        let fieldsHtml = '';
        
        if (mode === 'token') {
          const savedToken = localStorage.getItem('hades_cloudflare_token') || '';
          fieldsHtml = \`
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider">Tunnel Token <span class="text-red-400">*</span></label>
                <label class="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                  <input type="checkbox" id="save-token" class="size-3 rounded" \${savedToken ? 'checked' : ''}>
                  Save to browser
                </label>
              </div>
              <input type="password" name="token" id="field-token" placeholder="eyJhIjoiNzI0NGQ1NTg5NDdiZTJmY2Y5ZGJlMmY5NGNiNmY1ZDIi..." required
                value="\${savedToken}"
                class="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                onchange="handleFieldSave('cloudflare', 'token', this.value)">
              <p class="text-[10px] text-gray-600 mt-1">Get from: Zero Trust Dashboard → Networks → Tunnels → Create → Cloudflared</p>
            </div>
          \`;
        } else if (mode === 'local') {
          const savedTunnelName = localStorage.getItem('hades_cloudflare_cloudflareTunnelName') || '';
          const savedDomain = localStorage.getItem('hades_cloudflare_cloudflareDomain') || '';
          fieldsHtml = \`
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider">Tunnel Name <span class="text-gray-600">(optional)</span></label>
                <label class="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                  <input type="checkbox" id="save-cloudflareTunnelName" class="size-3 rounded" \${savedTunnelName ? 'checked' : ''}>
                  Save
                </label>
              </div>
              <input type="text" name="cloudflareTunnelName" id="field-cloudflareTunnelName" placeholder="my-app-tunnel"
                value="\${savedTunnelName}"
                class="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                onchange="handleFieldSave('cloudflare', 'cloudflareTunnelName', this.value)">
              <p class="text-[10px] text-gray-600 mt-1">Leave empty to use tunnel name from form</p>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-[10px] text-gray-500 uppercase tracking-wider">Domain <span class="text-gray-600">(optional)</span></label>
                <label class="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                  <input type="checkbox" id="save-cloudflareDomain" class="size-3 rounded" \${savedDomain ? 'checked' : ''}>
                  Save
                </label>
              </div>
              <input type="text" name="cloudflareDomain" id="field-cloudflareDomain" placeholder="app.yourdomain.com"
                value="\${savedDomain}"
                class="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                onchange="handleFieldSave('cloudflare', 'cloudflareDomain', this.value)">
              <p class="text-[10px] text-gray-600 mt-1">Your domain registered in Cloudflare (will auto-create DNS route)</p>
            </div>
          \`;
        }
        // Quick mode doesn't need extra fields
        
        if (cfFields) {
          cfFields.innerHTML = fieldsHtml;
        }
      }
      
      // Handle saving field to localStorage
      function handleFieldSave(provider, fieldName, value) {
        const checkbox = document.getElementById('save-' + fieldName);
        const storageKey = 'hades_' + provider + '_' + fieldName;
        if (checkbox && checkbox.checked && value) {
          localStorage.setItem(storageKey, value);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
      
      // Save on form submit
      document.getElementById('tunnel-form')?.addEventListener('submit', function() {
        const provider = document.querySelector('input[name="provider"]:checked')?.value;
        if (!provider) return;
        
        // Save all fields that have "save" checkbox checked
        document.querySelectorAll('[id^="save-"]').forEach(checkbox => {
          const fieldName = checkbox.id.replace('save-', '');
          const field = document.getElementById('field-' + fieldName);
          const storageKey = 'hades_' + provider + '_' + fieldName;
          if (checkbox.checked && field?.value) {
            localStorage.setItem(storageKey, field.value);
          }
        });
      });
      
      // Initialize with first provider
      document.addEventListener('DOMContentLoaded', () => selectProvider('pinggy'));
    </script>`;
}

export function installModal(): string {
  return `
    <div id="install-modal" class="fixed inset-0 z-50 hidden">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closeInstallModal()"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg">
        <div class="bg-dark-800 rounded-2xl border border-dark-700 shadow-2xl p-6 mx-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold flex items-center gap-2">
              <svg class="size-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              <span id="modal-title">Install Provider</span>
            </h3>
            <button onclick="closeInstallModal()" class="p-1 hover:bg-dark-700 rounded-lg transition-colors">
              <svg class="size-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <div id="modal-content" class="space-y-4">
            <!-- Content will be injected by JS -->
          </div>
          
          <div class="mt-6 flex gap-3">
            <button onclick="runInstall()" id="install-btn" class="flex-1 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-xl font-medium text-sm hover:opacity-90 flex items-center justify-center gap-2">
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Install Now
            </button>
            <button onclick="closeInstallModal()" class="px-4 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl text-sm transition-colors">Cancel</button>
          </div>
          
          <div id="install-output" class="hidden mt-4 p-3 bg-dark-900 rounded-lg max-h-48 overflow-y-auto">
            <pre class="text-xs text-gray-400 whitespace-pre-wrap" id="install-log"></pre>
          </div>
        </div>
      </div>
    </div>`;
}

export function tunnelCard(tunnel: TunnelInstance): string {
  const info = PROVIDERS[tunnel.config.provider];
  const statusConfig = {
    starting: { color: "bg-amber-500", text: "Starting", icon: `<svg class="animate-spin size-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>` },
    live: { color: "bg-emerald-500", text: "Live", icon: `<span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>` },
    closed: { color: "bg-gray-500", text: "Closed", icon: `<span class="size-1.5 rounded-full bg-gray-500"></span>` },
    error: { color: "bg-red-500", text: "Error", icon: `<svg class="size-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` },
  };
  const status = statusConfig[tunnel.status];
  const pid = tunnel.process?.pid;
  const uptime = tunnel.startedAt ? formatUptime(new Date().getTime() - tunnel.startedAt.getTime()) : '';

  return `
    <div class="tunnel-item bg-dark-800 rounded-xl border border-dark-700 overflow-hidden ${tunnel.status === "live" ? "border-l-2 border-l-emerald-500" : tunnel.status === "error" ? "border-l-2 border-l-red-500" : tunnel.status === "starting" ? "border-l-2 border-l-amber-500" : ""}">
      <!-- Header -->
      <div class="p-4 border-b border-dark-700">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="size-12 rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center text-white shadow-lg">${info.icon}</div>
            <div>
              <h3 class="font-semibold text-base">${tunnel.config.name}</h3>
              <p class="text-xs text-gray-500">${info.name} &bull; ${tunnel.config.localHost}:${tunnel.config.localPort}</p>
              <div class="flex items-center gap-2 mt-1">
                ${pid ? `<span class="text-[10px] text-gray-600 bg-dark-700 px-1.5 py-0.5 rounded">PID: ${pid}</span>` : ''}
                ${uptime && tunnel.status === 'live' ? `<span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Uptime: ${uptime}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}/20 text-white border border-${status.color.replace('bg-', '')}/30">
              ${status.icon}
              ${status.text}
            </span>
          </div>
        </div>
      </div>

      <!-- Terminal Output -->
      <div class="bg-dark-900 border-b border-dark-700">
        <div class="flex items-center justify-between px-3 py-1.5 bg-dark-800/50 border-b border-dark-700">
          <div class="flex items-center gap-2">
            <div class="flex gap-1">
              <span class="size-2.5 rounded-full bg-red-500/80"></span>
              <span class="size-2.5 rounded-full bg-amber-500/80"></span>
              <span class="size-2.5 rounded-full bg-emerald-500/80"></span>
            </div>
            <span class="text-[10px] text-gray-500 font-mono">terminal</span>
          </div>
          <button onclick="toggleTerminal('${tunnel.config.id}')" class="text-[10px] text-gray-500 hover:text-white transition-colors">
            <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
        </div>
        <div id="terminal-${tunnel.config.id}" class="p-3 font-mono text-[11px] leading-relaxed max-h-32 overflow-y-auto ${tunnel.status === 'starting' ? '' : 'max-h-24'}" ${tunnel.status === 'starting' ? 'hx-get="/api/tunnels/' + tunnel.config.id + '/logs" hx-trigger="every 1s" hx-swap="innerHTML"' : ''}>
          ${formatLogs(tunnel.logs)}
        </div>
      </div>

      <!-- Content -->
      <div class="p-4">
      ${tunnel.urls.length > 0 ? `
        <div class="mb-3 space-y-1.5">
          ${tunnel.urls.map(url => `
            <div class="flex items-center gap-2 bg-dark-700/50 rounded-lg px-3 py-2 border border-dark-600">
              <svg class="size-3.5 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
              <a href="${url}" target="_blank" class="text-xs text-violet-400 hover:text-violet-300 truncate flex-1">${url}</a>
              <button onclick="navigator.clipboard.writeText('${url}');this.innerHTML='<svg class=\\'size-3.5 text-emerald-400\\' fill=\\'none\\' stroke=\\'currentColor\\' viewBox=\\'0 0 24 24\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M5 13l4 4L19 7\\'/></svg>';setTimeout(()=>this.innerHTML='<svg class=\\'size-3.5\\' fill=\\'none\\' stroke=\\'currentColor\\' viewBox=\\'0 0 24 24\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z\\'/></svg>',1500)" class="p-1 hover:bg-dark-600 rounded transition-colors text-gray-400 hover:text-white">
                <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              </button>
              <a href="${url}" target="_blank" class="p-1 hover:bg-dark-600 rounded transition-colors text-gray-400 hover:text-white">
                <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              </a>
            </div>
          `).join("")}
        </div>
        ${tunnel.config.provider === "pinggy" && tunnel.extraInfo?.bypassHeader ? `
        <div class="mb-3 p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg">
          <div class="flex items-start gap-2">
            <svg class="size-4 text-sky-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div class="flex-1">
              <p class="text-xs text-sky-400 font-medium mb-1">Bypass Warning Page</p>
              <p class="text-[10px] text-sky-400/70 mb-2">First-time visitors see a security warning. For API/webhooks, add this header:</p>
              <div class="flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-2 mb-2">
                <code class="text-[11px] text-white font-mono flex-1">${tunnel.extraInfo.bypassHeader}</code>
                <button onclick="navigator.clipboard.writeText('${tunnel.extraInfo.bypassHeader}');this.innerHTML='Copied!';setTimeout(()=>this.innerHTML='Copy',1500)" class="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 rounded text-[10px] text-sky-400 transition-colors">
                  Copy
                </button>
              </div>
              <details class="text-[10px]">
                <summary class="text-sky-400/60 cursor-pointer hover:text-sky-400">Usage examples</summary>
                <div class="mt-2 p-2 bg-dark-800 rounded text-gray-400 space-y-2">
                  <p><strong class="text-emerald-400">curl:</strong></p>
                  <code class="block bg-dark-700 px-2 py-1 rounded text-[9px] break-all">curl -H "X-Pinggy-No-Screen: true" ${tunnel.urls[0]}</code>
                  <p class="mt-2"><strong class="text-amber-400">fetch (JS):</strong></p>
                  <code class="block bg-dark-700 px-2 py-1 rounded text-[9px] break-all">fetch("${tunnel.urls[0]}", { headers: { "X-Pinggy-No-Screen": "true" } })</code>
                  <p class="mt-2 text-violet-400">Or use custom User-Agent header</p>
                </div>
              </details>
            </div>
          </div>
        </div>` : ''}
        ${tunnel.config.provider === "ngrok" && tunnel.extraInfo?.dashboard ? `
        <div class="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div class="flex items-start gap-2">
            <svg class="size-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <div class="flex-1">
              <p class="text-xs text-emerald-400 font-medium mb-1">ngrok Web Inspector</p>
              <p class="text-[10px] text-emerald-400/70 mb-2">View requests, replay them, and debug your tunnel</p>
              <a href="${tunnel.extraInfo.dashboard}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg text-xs text-emerald-400 transition-colors">
                <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                Open Dashboard (localhost:4040)
              </a>
            </div>
          </div>
        </div>` : ''}
        ${tunnel.config.provider === "cloudflare" && tunnel.extraInfo?.mode ? `
        <div class="mb-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <div class="flex items-start gap-2">
            <svg class="size-4 text-orange-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.2678-.2246-.2793-.5732-.4268-.9834-.4473l-8.1572-.1123c-.0654-.0039-.1123-.0215-.1416-.0537-.0283-.0303-.0381-.0703-.0263-.1113.0205-.0703.0859-.127.1533-.127l8.2666-.1132c.8809-.0303 1.8027-.752 2.0889-1.6455l.3496-1.0898c.0146-.0478.0146-.0957.0156-.1435.0019-.0429-.0117-.085-.0166-.127-.4482-2.9297-3.0313-5.166-6.1621-5.166-3.457 0-6.2676 2.8008-6.2676 6.2568 0 .1983.0234.3925.0361.5878-.7832-.0303-1.5039.2442-2.0566.7569-.5908.5489-.9316 1.3291-.9316 2.1308 0 .1221.0088.2432.0254.3633h.0039c.0058.0322.0205.0634.0459.0868l.084.0732h13.0459c.0771 0 .1484-.0527.1699-.127l.2686-.8584z"/>
            </svg>
            <div class="flex-1">
              <p class="text-xs text-orange-400 font-medium mb-1">Cloudflare Tunnel</p>
              <p class="text-[10px] text-orange-400/70 mb-2">${tunnel.extraInfo.mode}: ${tunnel.extraInfo.note || ''}</p>
              ${tunnel.extraInfo.dashboard ? `
              <a href="${tunnel.extraInfo.dashboard}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg text-xs text-orange-400 transition-colors">
                <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                Zero Trust Dashboard
              </a>` : ''}
              <details class="text-[10px] mt-2">
                <summary class="text-orange-400/60 cursor-pointer hover:text-orange-400">Usage tips</summary>
                <div class="mt-2 p-2 bg-dark-800 rounded text-gray-400 space-y-1">
                  <p><strong class="text-emerald-400">Quick Tunnel:</strong> Temporary URL, great for development</p>
                  <p><strong class="text-amber-400">Named Tunnel:</strong> Persistent URL with Cloudflare dashboard</p>
                  <p><strong class="text-sky-400">Documentation:</strong></p>
                  <a href="https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/" target="_blank" class="text-violet-400 hover:underline block">developers.cloudflare.com/cloudflare-one</a>
                </div>
              </details>
            </div>
          </div>
        </div>` : ''}
        ${tunnel.password ? `
        <div class="mb-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
          <div class="flex items-start gap-2">
            <svg class="size-4 text-violet-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
            </svg>
            <div class="flex-1">
              <p class="text-xs text-violet-400 font-medium mb-1">Tunnel Password</p>
              <p class="text-[10px] text-violet-400/70 mb-2">Enter this when prompted in browser (first visit only per IP)</p>
              <div class="flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-2 mb-2">
                <svg class="size-3.5 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <code class="text-sm text-white font-mono flex-1">${tunnel.password}</code>
                <button onclick="navigator.clipboard.writeText('${tunnel.password}');this.innerHTML='<svg class=\\'size-3.5 text-emerald-400\\' fill=\\'none\\' stroke=\\'currentColor\\' viewBox=\\'0 0 24 24\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M5 13l4 4L19 7\\'/></svg> Copied!';setTimeout(()=>this.innerHTML='<svg class=\\'size-3.5\\' fill=\\'none\\' stroke=\\'currentColor\\' viewBox=\\'0 0 24 24\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z\\'/></svg> Copy',1500)" class="px-2 py-1 bg-violet-500/20 hover:bg-violet-500/30 rounded text-[10px] text-violet-400 flex items-center gap-1 transition-colors">
                  <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  Copy
                </button>
              </div>
              <details class="text-[10px]">
                <summary class="text-violet-400/60 cursor-pointer hover:text-violet-400">Troubleshooting tips</summary>
                <div class="mt-2 p-2 bg-dark-800 rounded text-gray-400 space-y-1">
                  <p><strong class="text-amber-400">503 Error?</strong> Make sure your app is running on port ${tunnel.config.localPort}</p>
                  <p><strong class="text-emerald-400">For API/Webhooks:</strong> Add header <code class="bg-dark-700 px-1 rounded">bypass-tunnel-reminder: true</code></p>
                  <p><strong class="text-sky-400">Test with curl:</strong></p>
                  <code class="block bg-dark-700 px-2 py-1 rounded mt-1 text-[9px] break-all">curl -H "bypass-tunnel-reminder: true" ${tunnel.urls[0]}</code>
                </div>
              </details>
            </div>
          </div>
        </div>` : ''}` : tunnel.status === "starting" ? `
        <div class="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div class="flex items-center gap-2">
            <svg class="animate-spin size-4 text-amber-400" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <p class="text-xs text-amber-400">Establishing tunnel connection...</p>
          </div>
        </div>` : ""}
      ${tunnel.error ? `
        <div class="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div class="flex items-start gap-2">
            <svg class="size-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <p class="text-xs text-red-400 font-medium">Error</p>
              <p class="text-xs text-red-400/80 mt-0.5">${tunnel.error}</p>
            </div>
          </div>
        </div>` : ""}
      <div class="flex gap-2">
        ${tunnel.status === "live" ? `
          <button hx-post="/api/tunnels/${tunnel.config.id}/stop" hx-target="closest .tunnel-item" hx-swap="outerHTML" hx-indicator="#stop-spinner-${tunnel.config.id}" class="flex-1 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors">
            <span id="stop-spinner-${tunnel.config.id}" class="htmx-indicator"><svg class="animate-spin size-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></span>
            <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>
            Stop
          </button>` : ""}
        ${tunnel.status === "error" || tunnel.status === "closed" ? `
          <button hx-post="/api/tunnels/${tunnel.config.id}/restart" hx-target="closest .tunnel-item" hx-swap="outerHTML" class="flex-1 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors">
            <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Restart
          </button>` : ""}
        <button hx-delete="/api/tunnels/${tunnel.config.id}" hx-target="closest .tunnel-item" hx-swap="outerHTML" hx-confirm="Delete tunnel '${tunnel.config.name}'?" class="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors">
          <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Delete
        </button>
      </div>
      </div>
    </div>`;
}

export function tunnelList(tunnels: TunnelInstance[]): string {
  if (tunnels.length === 0) {
    return `
      <div class="text-center py-10 text-gray-500">
        <svg class="size-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
        </svg>
        <p class="font-medium">No tunnels</p>
        <p class="text-xs">Create one to get started</p>
      </div>`;
  }
  return tunnels.map(tunnelCard).join("");
}

export function statsHeader(stats: { total: number; live: number }) {
  return `
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-base font-semibold">Tunnels</h2>
      <div class="flex items-center gap-3 text-xs">
        <span class="text-gray-500">${stats.total} total</span>
        <span class="flex items-center gap-1 text-emerald-400">
          <span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          ${stats.live} live
        </span>
      </div>
    </div>`;
}
