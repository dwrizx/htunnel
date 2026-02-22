import { PROVIDERS } from "./components";

export function layout(content: string, title = "Hades Tunnel"): string {
  const providersJson = JSON.stringify(PROVIDERS);

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            dark: { 900: '#0a0a0a', 800: '#141414', 700: '#1f1f1f', 600: '#2a2a2a' }
          }
        }
      }
    }
  </script>
  <style>
    .htmx-indicator { display: none; }
    .htmx-request .htmx-indicator { display: inline-flex; }
    .provider-card { transition: all 0.2s ease; }
    .provider-card:hover { transform: translateY(-2px); }
    .fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    .pulse-glow { animation: pulseGlow 2s infinite; }
    @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.3); } 50% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.6); } }
    .slide-up { animation: slideUp 0.3s ease-out; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    input:focus { box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2); }
  </style>
</head>
<body class="bg-dark-900 text-gray-100 min-h-screen antialiased">
  <div class="max-w-5xl mx-auto px-4 py-8">
    <header class="mb-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20 pulse-glow">
            <svg class="size-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Hades Tunnel</h1>
            <p class="text-xs text-gray-500">Multi-provider tunnel manager</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a href="/help" class="p-2 hover:bg-dark-700 rounded-lg transition-colors text-gray-400 hover:text-white">
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </a>
          <a href="/install" class="p-2 hover:bg-dark-700 rounded-lg transition-colors text-gray-400 hover:text-white">
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </a>
        </div>
      </div>
    </header>
    <main class="slide-up">${content}</main>
    <footer class="mt-12 pt-6 border-t border-dark-700 text-center text-gray-600 text-xs">
      <p>Pinggy &bull; Cloudflare &bull; ngrok &bull; Localtunnel</p>
    </footer>
  </div>
  <script>
    const PROVIDERS = ${providersJson};
    let currentInstallProvider = null;
    
    document.body.addEventListener('htmx:afterSwap', (e) => {
      e.detail.target.querySelectorAll('.tunnel-item').forEach(el => el.classList.add('fade-in'));
      // Auto-scroll terminals
      document.querySelectorAll('[id^="terminal-"]').forEach(el => {
        el.scrollTop = el.scrollHeight;
      });
    });
    
    function toggleTerminal(id) {
      const terminal = document.getElementById('terminal-' + id);
      if (terminal) {
        if (terminal.style.maxHeight === '0px') {
          terminal.style.maxHeight = '128px';
          terminal.style.padding = '12px';
        } else {
          terminal.style.maxHeight = '0px';
          terminal.style.padding = '0 12px';
        }
      }
    }
    
    function showInstallModal(provider) {
      currentInstallProvider = provider;
      const modal = document.getElementById('install-modal');
      const title = document.getElementById('modal-title');
      const content = document.getElementById('modal-content');
      const info = PROVIDERS[provider];
      
      title.textContent = 'Install ' + info.name;
      
      const installCommands = info.installCommands || {};
      content.innerHTML = \`
        <p class="text-sm text-gray-400">Choose your operating system to see installation instructions:</p>
        <div class="space-y-3">
          <div class="p-3 bg-dark-700 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <svg class="size-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M20.581 19.049c-.55-.446-.336-1.431-.907-1.917.553-3.365-.997-6.331-2.845-8.232-1.551-1.595-1.051-3.147-1.051-4.49 0-2.146-.881-4.41-3.55-4.41-2.67 0-3.55 2.264-3.55 4.41 0 1.343.5 2.895-1.051 4.49-1.848 1.901-3.398 4.867-2.845 8.232-.571.486-.357 1.471-.907 1.917-.665.538-.493 1.529.5 1.951.893.38 2.01.131 2.86-.369.56-.331 1.188-.549 1.833-.687.645-.139 1.299-.209 1.955-.209.656 0 1.31.07 1.955.209.645.138 1.273.356 1.833.687.85.5 1.967.749 2.86.369.993-.422 1.165-1.413.5-1.951z"/></svg>
              <span class="text-sm font-medium text-white">Linux</span>
            </div>
            <code class="block text-xs text-gray-300 bg-dark-900 p-2 rounded overflow-x-auto">\${installCommands.linux || 'Not available'}</code>
          </div>
          <div class="p-3 bg-dark-700 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <svg class="size-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              <span class="text-sm font-medium text-white">macOS</span>
            </div>
            <code class="block text-xs text-gray-300 bg-dark-900 p-2 rounded overflow-x-auto">\${installCommands.macos || 'Not available'}</code>
          </div>
          \${installCommands.windows ? \`
          <div class="p-3 bg-dark-700 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <svg class="size-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
              <span class="text-sm font-medium text-white">Windows</span>
            </div>
            <code class="block text-xs text-gray-300 bg-dark-900 p-2 rounded overflow-x-auto">\${installCommands.windows}</code>
          </div>\` : ''}
        </div>
      \`;
      
      modal.classList.remove('hidden');
      document.getElementById('install-output').classList.add('hidden');
    }
    
    function closeInstallModal() {
      document.getElementById('install-modal').classList.add('hidden');
      currentInstallProvider = null;
    }
    
    async function runInstall() {
      if (!currentInstallProvider) return;
      
      const btn = document.getElementById('install-btn');
      const output = document.getElementById('install-output');
      const log = document.getElementById('install-log');
      
      btn.disabled = true;
      btn.innerHTML = '<svg class="animate-spin size-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Installing...';
      output.classList.remove('hidden');
      log.textContent = 'Starting installation...\\n';
      
      try {
        const response = await fetch('/api/install/' + currentInstallProvider, { method: 'POST' });
        const data = await response.json();
        
        log.textContent += data.output + '\\n';
        
        if (data.success) {
          log.textContent += '\\n✓ Installation completed successfully!';
          btn.innerHTML = '<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Installed!';
          btn.classList.remove('from-violet-500', 'to-fuchsia-500');
          btn.classList.add('bg-emerald-500');
          setTimeout(() => location.reload(), 1500);
        } else {
          log.textContent += '\\n✗ Installation failed. Please install manually.';
          btn.innerHTML = 'Installation Failed';
          btn.classList.remove('from-violet-500', 'to-fuchsia-500');
          btn.classList.add('bg-red-500');
        }
      } catch (error) {
        log.textContent += '\\n✗ Error: ' + error.message;
        btn.innerHTML = 'Error';
        btn.classList.add('bg-red-500');
      }
      
      btn.disabled = false;
    }
    
    document.querySelectorAll('input[name="provider"]').forEach(radio => {
      radio.addEventListener('change', function() {
        const warning = document.getElementById('install-warning');
        if (this.dataset.needsInstall === 'true') {
          warning?.classList.remove('hidden');
        } else {
          warning?.classList.add('hidden');
        }
      });
    });
  </script>
</body>
</html>`;
}
