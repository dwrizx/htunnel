import {
  useEffect,
  useDeferredValue,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import {
  createTunnel,
  deleteTunnel,
  getProviderStatus,
  restartTunnel,
  stopTunnel,
  updateTunnel,
  updateProviderTool,
  type ProviderStatus,
  type TunnelItem,
  type TunnelStats,
  type UpdateTunnelInput,
} from "../lib/api";
import { LanguageSwitcher } from "../components/language-switcher";

const createTunnelSchema = z.object({
  provider: z.enum(["pinggy", "cloudflare", "ngrok", "localtunnel"]),
  name: z.string().min(1, "Name is required"),
  localPort: z.coerce.number().int().min(1).max(65535),
  localHost: z.string().min(1),
  token: z.string().optional(),
  cloudflareMode: z.enum(["quick", "local", "token"]).optional(),
});

type FormState = z.infer<typeof createTunnelSchema>;
type UiSettings = {
  compactLogs: boolean;
  confirmDelete: boolean;
};

const defaultForm: FormState = {
  provider: "pinggy",
  name: "",
  localPort: 3000,
  localHost: "localhost",
  token: "",
  cloudflareMode: "quick",
};

export default function DashboardRoute() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [streamState, setStreamState] = useState<
    "connecting" | "live" | "disconnected"
  >("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [stats, setStats] = useState<TunnelStats>({
    total: 0,
    live: 0,
    error: 0,
    closed: 0,
  });
  const [tunnels, setTunnels] = useState<TunnelItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<
    "all" | ProviderStatus["provider"]
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | TunnelItem["status"]
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "status">("newest");
  const [showSettings, setShowSettings] = useState(false);
  const [updatingProvider, setUpdatingProvider] = useState<
    ProviderStatus["provider"] | null
  >(null);
  const [uiSettings, setUiSettings] = useState<UiSettings>({
    compactLogs: false,
    confirmDelete: true,
  });

  const selectedProvider = useMemo(
    () => providers.find((p) => p.provider === form.provider),
    [providers, form.provider],
  );
  const deferredSearch = useDeferredValue(search);
  const visibleTunnels = useMemo(() => {
    let items = [...tunnels];
    if (providerFilter !== "all") {
      items = items.filter((t) => t.config.provider === providerFilter);
    }
    if (statusFilter !== "all") {
      items = items.filter((t) => t.status === statusFilter);
    }
    if (deferredSearch.trim()) {
      const needle = deferredSearch.toLowerCase();
      items = items.filter((t) => {
        return (
          t.config.name.toLowerCase().includes(needle) ||
          t.config.provider.toLowerCase().includes(needle) ||
          t.urls.some((url) => url.toLowerCase().includes(needle))
        );
      });
    }

    if (sortBy === "name") {
      items.sort((a, b) => a.config.name.localeCompare(b.config.name));
    } else if (sortBy === "status") {
      const rank: Record<TunnelItem["status"], number> = {
        live: 0,
        starting: 1,
        error: 2,
        closed: 3,
      };
      items.sort((a, b) => rank[a.status] - rank[b.status]);
    } else {
      items.sort((a, b) => {
        const at = a.startedAt ? Date.parse(a.startedAt) : 0;
        const bt = b.startedAt ? Date.parse(b.startedAt) : 0;
        return bt - at;
      });
    }
    return items;
  }, [tunnels, providerFilter, statusFilter, deferredSearch, sortBy]);

  async function refresh() {
    const providerStatus = await getProviderStatus();
    setProviders(providerStatus);
  }

  useEffect(() => {
    refresh().catch(() => {
      setStatusMessage(
        "Failed to load API status. Is backend running on :4000?",
      );
    });

    const source = new EventSource("/api/v1/tunnels/events");
    source.onopen = () => {
      setStreamState("live");
      setStatusMessage("");
    };
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          tunnels: TunnelItem[];
          stats: TunnelStats;
        };
        setTunnels(payload.tunnels);
        setStats(payload.stats);
        setLastSyncAt(new Date());
      } catch {
        // keep previous data on malformed payloads
      }
    };
    source.onerror = () => {
      setStreamState("disconnected");
      setStatusMessage("Realtime stream disconnected. Reconnecting...");
    };

    return () => source.close();
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("hadestunnel_ui_settings");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<UiSettings>;
      setUiSettings({
        compactLogs: Boolean(parsed.compactLogs),
        confirmDelete:
          parsed.confirmDelete === undefined ? true : parsed.confirmDelete,
      });
    } catch {
      // ignore corrupted local settings
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("hadestunnel_ui_settings", JSON.stringify(uiSettings));
  }, [uiSettings]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage("");
    setErrors({});

    const parsed = createTunnelSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    try {
      setBusy(true);
      await createTunnel({
        provider: parsed.data.provider,
        name: parsed.data.name,
        localHost: parsed.data.localHost,
        localPort: parsed.data.localPort,
        token: shouldShowTokenField(
          parsed.data.provider,
          parsed.data.cloudflareMode,
        )
          ? parsed.data.token || undefined
          : undefined,
        cloudflareMode:
          parsed.data.provider === "cloudflare"
            ? parsed.data.cloudflareMode || "quick"
            : undefined,
      });
      setStatusMessage("Tunnel request sent successfully.");
      setForm((prev) => ({ ...prev, name: "" }));
      await refresh();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to create tunnel",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(
    action: "stop" | "restart" | "delete",
    tunnelId: string,
  ) {
    if (action === "delete" && uiSettings.confirmDelete) {
      const confirmed = window.confirm(
        "Delete this tunnel? This action cannot be undone.",
      );
      if (!confirmed) return;
    }

    const prevTunnels = tunnels;
    setTunnels((current) =>
      current
        .map((t): TunnelItem => {
          if (t.id !== tunnelId) return t;
          if (action === "stop") {
            return {
              ...t,
              status: "closed" as const,
              logs: [...t.logs, "Stopping tunnel...", "Tunnel stopped"],
            };
          }
          if (action === "restart") {
            return {
              ...t,
              status: "starting" as const,
              logs: [...t.logs, "Restarting tunnel..."],
            };
          }
          return t;
        })
        .filter((t) => !(action === "delete" && t.id === tunnelId)),
    );
    try {
      setStatusMessage("");
      if (action === "stop") await stopTunnel(tunnelId);
      if (action === "restart") await restartTunnel(tunnelId);
      if (action === "delete") await deleteTunnel(tunnelId);
      await refresh();
    } catch (error) {
      setTunnels(prevTunnels);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : `Failed to ${action} tunnel ${tunnelId}`,
      );
    }
  }

  async function handleStopAllLive() {
    const liveItems = tunnels.filter((tunnel) => tunnel.status === "live");
    if (liveItems.length === 0) {
      setStatusMessage("No live tunnels to stop.");
      return;
    }

    try {
      setStatusMessage("Stopping all live tunnels...");
      await Promise.all(liveItems.map((tunnel) => stopTunnel(tunnel.id)));
      setStatusMessage(`Stopped ${liveItems.length} live tunnel(s).`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to stop all tunnels",
      );
    }
  }

  async function handleDeleteClosed() {
    const closedItems = tunnels.filter((tunnel) => tunnel.status === "closed");
    if (closedItems.length === 0) {
      setStatusMessage("No closed tunnels to delete.");
      return;
    }

    try {
      setStatusMessage("Deleting closed tunnels...");
      await Promise.all(closedItems.map((tunnel) => deleteTunnel(tunnel.id)));
      setStatusMessage(`Deleted ${closedItems.length} closed tunnel(s).`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to delete tunnels",
      );
    }
  }

  async function handleCopyAllUrls() {
    const urls = tunnels.flatMap((tunnel) => tunnel.urls).filter(Boolean);
    if (urls.length === 0) {
      setStatusMessage("No tunnel URL available to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      setStatusMessage(`Copied ${urls.length} URL(s) to clipboard.`);
    } catch {
      setStatusMessage("Clipboard permission denied.");
    }
  }

  async function handleUpdateProvider(provider: ProviderStatus["provider"]) {
    try {
      setUpdatingProvider(provider);
      setStatusMessage(`Updating ${provider} tool...`);
      const result = await updateProviderTool(provider);
      if (result.updated) {
        setStatusMessage(
          `${provider} updated: ${result.versionBefore || "unknown"} -> ${result.versionAfter || "latest"}`,
        );
      } else {
        setStatusMessage(
          `${provider} checked. Current version is already latest or unchanged.`,
        );
      }
      await refresh();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : `Failed to update ${provider}`,
      );
    } finally {
      setUpdatingProvider(null);
    }
  }

  function openEditor(tunnel: TunnelItem) {
    setEditingId(tunnel.id);
    setEditForm({
      provider: tunnel.config.provider,
      name: tunnel.config.name,
      localPort: tunnel.config.localPort,
      localHost: tunnel.config.localHost,
      token: tunnel.config.token || "",
      cloudflareMode: tunnel.config.cloudflareMode || "quick",
    });
    setStatusMessage(`Editing tunnel: ${tunnel.config.name}`);
  }

  function closeEditor() {
    setEditingId(null);
    setEditForm(null);
    setStatusMessage("Edit cancelled.");
  }

  async function saveEditor() {
    if (!editingId || !editForm) return;

    const parsed = createTunnelSchema.safeParse(editForm);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setStatusMessage(firstIssue?.message || "Invalid update payload");
      return;
    }

    try {
      const input: UpdateTunnelInput = {
        provider: parsed.data.provider,
        name: parsed.data.name,
        localHost: parsed.data.localHost,
        localPort: parsed.data.localPort,
        token: shouldShowTokenField(
          parsed.data.provider,
          parsed.data.cloudflareMode,
        )
          ? parsed.data.token || undefined
          : undefined,
        cloudflareMode:
          parsed.data.provider === "cloudflare"
            ? parsed.data.cloudflareMode || "quick"
            : undefined,
      };

      await updateTunnel(editingId, input);
      setStatusMessage("Tunnel updated and restarted.");
      setEditingId(null);
      setEditForm(null);
      await refresh();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to update tunnel",
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <fbt desc="App title">Hades Tunnel React Console</fbt>
          </h1>
          <p className="text-sm text-slate-400">
            <fbt desc="Subtitle">
              Vite 8 + React Compiler + Tailwind + Zod + fbtee + React Router
            </fbt>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                streamState === "live"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : streamState === "connecting"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  streamState === "live"
                    ? "bg-emerald-300"
                    : streamState === "connecting"
                      ? "bg-amber-300"
                      : "bg-red-300"
                }`}
              />
              SSE {streamState}
            </span>
            <span className="text-slate-500">
              Last sync: {lastSyncAt ? lastSyncAt.toLocaleTimeString() : "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => setShowSettings((v) => !v)}
          >
            Settings
          </button>
          <LanguageSwitcher />
        </div>
      </header>

      {showSettings ? (
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl">
          <h2 className="mb-3 text-sm font-medium text-slate-200">
            Dashboard Settings
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
              <span>Compact logs in cards</span>
              <input
                type="checkbox"
                checked={uiSettings.compactLogs}
                onChange={(e) =>
                  setUiSettings((prev) => ({
                    ...prev,
                    compactLogs: e.target.checked,
                  }))
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
              <span>Confirm before delete</span>
              <input
                type="checkbox"
                checked={uiSettings.confirmDelete}
                onChange={(e) =>
                  setUiSettings((prev) => ({
                    ...prev,
                    confirmDelete: e.target.checked,
                  }))
                }
              />
            </label>
          </div>
        </section>
      ) : null}

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Live" value={stats.live} tone="emerald" />
        <StatCard label="Error" value={stats.error} tone="red" />
        <StatCard label="Closed" value={stats.closed} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl"
        >
          <h2 className="mb-4 text-sm font-medium text-slate-300">
            <fbt desc="Create tunnel heading">Create tunnel</fbt>
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Provider" error={errors.provider}>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={form.provider}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    provider: e.target.value as FormState["provider"],
                  }))
                }
              >
                <option value="pinggy">Pinggy</option>
                <option value="cloudflare">Cloudflare</option>
                <option value="ngrok">ngrok</option>
                <option value="localtunnel">Localtunnel</option>
              </select>
            </Field>

            <Field label="Name" error={errors.name}>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="my-tunnel"
              />
            </Field>

            <Field label="Local Host" error={errors.localHost}>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={form.localHost}
                onChange={(e) =>
                  setForm((s) => ({ ...s, localHost: e.target.value }))
                }
                placeholder="localhost"
              />
            </Field>

            <Field label="Local Port" error={errors.localPort}>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={form.localPort}
                onChange={(e) =>
                  setForm((s) => ({ ...s, localPort: Number(e.target.value) }))
                }
                placeholder="3000"
              />
            </Field>
          </div>

          {form.provider === "cloudflare" ? (
            <Field label="Cloudflare Mode">
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={form.cloudflareMode || "quick"}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    cloudflareMode: e.target.value as
                      | "quick"
                      | "local"
                      | "token",
                  }))
                }
              >
                <option value="quick">Quick (Instant temp URL)</option>
                <option value="token">Token (Cloudflare Dashboard)</option>
                <option value="local">Local (Named tunnel)</option>
              </select>
            </Field>
          ) : null}

          {shouldShowTokenField(form.provider, form.cloudflareMode) ? (
            <Field label="Token (Optional)">
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={form.token || ""}
                onChange={(e) =>
                  setForm((s) => ({ ...s, token: e.target.value }))
                }
                placeholder={
                  form.provider === "ngrok"
                    ? "ngrok authtoken"
                    : "cloudflare tunnel token"
                }
              />
            </Field>
          ) : (
            <p className="mb-3 text-xs text-slate-500">
              Token field is hidden because this provider mode does not require
              token.
            </p>
          )}

          {selectedProvider ? (
            <p className="mb-2 text-xs text-slate-500">
              Provider status:{" "}
              {selectedProvider.installed ? "Ready" : "Needs install"}
              {selectedProvider.version
                ? ` (v${selectedProvider.version})`
                : ""}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-60"
          >
            {busy ? "Submitting..." : "Create Tunnel"}
          </button>
        </form>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl">
          <h2 className="mb-4 text-sm font-medium text-slate-300">
            Provider health
          </h2>
          <div className="space-y-2">
            {providers.map((provider) => (
              <div
                key={provider.provider}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
              >
                <span className="capitalize">{provider.provider}</span>
                <div className="flex items-center gap-2">
                  {provider.version ? (
                    <span className="text-xs text-slate-500">
                      v{provider.version}
                    </span>
                  ) : null}
                  {provider.provider === "cloudflare" ||
                  provider.provider === "ngrok" ? (
                    <button
                      type="button"
                      disabled={updatingProvider === provider.provider}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                      onClick={() => {
                        void handleUpdateProvider(provider.provider);
                      }}
                    >
                      {updatingProvider === provider.provider
                        ? "Updating..."
                        : "Update Tool"}
                    </button>
                  ) : null}
                  <span
                    className={
                      provider.installed
                        ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300"
                        : "rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300"
                    }
                  >
                    {provider.installed ? "Ready" : "Install"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300">Live tunnels</h2>
          <span className="text-xs text-slate-500">Realtime via SSE</span>
        </div>

        {editingId && editForm ? (
          <div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-sky-200">
                Update tunnel by click
              </p>
              <span className="text-xs text-sky-100/80">{editingId}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <input
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((s) => (s ? { ...s, name: e.target.value } : s))
                }
                placeholder="Tunnel name"
              />
              <input
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={editForm.localHost}
                onChange={(e) =>
                  setEditForm((s) =>
                    s ? { ...s, localHost: e.target.value } : s,
                  )
                }
                placeholder="localhost"
              />
              <input
                type="number"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={editForm.localPort}
                onChange={(e) =>
                  setEditForm((s) =>
                    s ? { ...s, localPort: Number(e.target.value) } : s,
                  )
                }
                placeholder="3000"
              />
              <select
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={editForm.provider}
                onChange={(e) =>
                  setEditForm((s) =>
                    s
                      ? {
                          ...s,
                          provider: e.target.value as FormState["provider"],
                        }
                      : s,
                  )
                }
              >
                <option value="pinggy">Pinggy</option>
                <option value="cloudflare">Cloudflare</option>
                <option value="ngrok">ngrok</option>
                <option value="localtunnel">Localtunnel</option>
              </select>
              {editForm.provider === "cloudflare" ? (
                <select
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={editForm.cloudflareMode || "quick"}
                  onChange={(e) =>
                    setEditForm((s) =>
                      s
                        ? {
                            ...s,
                            cloudflareMode: e.target.value as
                              | "quick"
                              | "local"
                              | "token",
                          }
                        : s,
                    )
                  }
                >
                  <option value="quick">Quick</option>
                  <option value="token">Token</option>
                  <option value="local">Local</option>
                </select>
              ) : (
                <div />
              )}
              {shouldShowTokenField(
                editForm.provider,
                editForm.cloudflareMode,
              ) ? (
                <input
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={editForm.token || ""}
                  onChange={(e) =>
                    setEditForm((s) =>
                      s ? { ...s, token: e.target.value } : s,
                    )
                  }
                  placeholder={
                    editForm.provider === "ngrok"
                      ? "ngrok authtoken"
                      : "cloudflare tunnel token"
                  }
                />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-500">
                  Token is not needed for this provider mode.
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500"
                onClick={() => {
                  void saveEditor();
                }}
              >
                Save Update
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                onClick={closeEditor}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => {
              setSearch("");
              setProviderFilter("all");
              setStatusFilter("all");
              setSortBy("newest");
              setStatusMessage("Filter reset.");
            }}
          >
            Reset Filter
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => {
              void handleCopyAllUrls();
            }}
          >
            Copy All URLs
          </button>
          <button
            type="button"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
            onClick={() => {
              void handleStopAllLive();
            }}
          >
            Stop All Live
          </button>
          <button
            type="button"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/20"
            onClick={() => {
              void handleDeleteClosed();
            }}
          >
            Delete Closed
          </button>
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Search name/provider/url"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={providerFilter}
            onChange={(e) =>
              setProviderFilter(
                e.target.value as "all" | ProviderStatus["provider"],
              )
            }
          >
            <option value="all">All providers</option>
            <option value="pinggy">Pinggy</option>
            <option value="cloudflare">Cloudflare</option>
            <option value="ngrok">ngrok</option>
            <option value="localtunnel">Localtunnel</option>
          </select>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | TunnelItem["status"])
            }
          >
            <option value="all">All status</option>
            <option value="live">Live</option>
            <option value="starting">Starting</option>
            <option value="error">Error</option>
            <option value="closed">Closed</option>
          </select>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "newest" | "name" | "status")
            }
          >
            <option value="newest">Sort: Newest</option>
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>

        {visibleTunnels.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-500">
            No tunnels match your filter. Create one or reset filter.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleTunnels.map((tunnel) => (
              <TunnelCard
                key={tunnel.id}
                tunnel={tunnel}
                onStop={() => handleAction("stop", tunnel.id)}
                onRestart={() => handleAction("restart", tunnel.id)}
                onDelete={() => handleAction("delete", tunnel.id)}
                onEdit={() => openEditor(tunnel)}
                compactLogs={uiSettings.compactLogs}
              />
            ))}
          </div>
        )}
      </section>

      {statusMessage ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 mx-auto w-full max-w-xl px-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2 text-sm text-slate-200 shadow-2xl backdrop-blur">
            {statusMessage}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field(props: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
        {props.label}
      </span>
      {props.children}
      {props.error ? (
        <span className="mt-1 block text-xs text-red-300">{props.error}</span>
      ) : null}
    </label>
  );
}

function StatCard(props: {
  label: string;
  value: number;
  tone?: "red" | "emerald";
}) {
  const toneClass =
    props.tone === "red"
      ? "border-red-500/20 bg-red-500/5 text-red-300"
      : props.tone === "emerald"
        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
        : "border-slate-700 bg-slate-900/70 text-slate-100";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-80">
        {props.label}
      </p>
      <p className="mt-1 text-xl font-semibold">{props.value}</p>
    </div>
  );
}

function TunnelCard(props: {
  tunnel: TunnelItem;
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onEdit: () => void;
  compactLogs: boolean;
}) {
  const { tunnel } = props;
  const isCloudflareQuick =
    tunnel.config.provider === "cloudflare" &&
    !tunnel.config.token &&
    !tunnel.config.cloudflareTunnelName &&
    !tunnel.config.cloudflareDomain;
  const isQuickProvisioning =
    isCloudflareQuick &&
    tunnel.status === "starting" &&
    tunnel.urls.length === 0;
  const statusTone =
    tunnel.status === "live"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      : tunnel.status === "error"
        ? "border-red-500/30 bg-red-500/5 text-red-300"
        : tunnel.status === "starting"
          ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
          : "border-slate-700 bg-slate-900/70 text-slate-300";

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-slate-100">
            {tunnel.config.name}
          </h3>
          <p className="text-xs text-slate-500">
            <span className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
              {tunnel.config.provider}
            </span>{" "}
            • {tunnel.config.localHost}:{tunnel.config.localPort}
            {tunnel.startedAt
              ? ` • up ${formatUptimeLabel(tunnel.startedAt)}`
              : ""}
          </p>
          <Link
            to={`/tunnels/${tunnel.id}`}
            className="text-[11px] text-violet-300 hover:text-violet-200"
          >
            Open detail
          </Link>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs capitalize ${statusTone}`}
        >
          {tunnel.status}
        </span>
      </div>

      {tunnel.urls.length > 0 ? (
        <div className="mb-3 space-y-1">
          {tunnel.urls.map((url) => (
            <div
              key={url}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs"
            >
              <a
                className="truncate text-violet-300 hover:text-violet-200"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                {url}
              </a>
              <button
                type="button"
                className="ml-auto rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                onClick={() => navigator.clipboard.writeText(url)}
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {isQuickProvisioning ? (
        <div className="mb-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1.5 text-xs text-sky-200">
          <p className="font-medium">
            Cloudflare Quick tunnel is provisioning temporary URL...
          </p>
          <p className="mt-0.5 text-sky-100/80">
            If URL is not shown within 60 seconds, use Reconnect Quick.
          </p>
        </div>
      ) : null}

      {tunnel.error ? (
        <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300">
          {tunnel.error}
        </p>
      ) : null}

      <div
        className={`mb-3 overflow-auto rounded-lg border border-slate-800 bg-black/40 p-2 font-mono text-[11px] ${
          props.compactLogs ? "max-h-24" : "max-h-36"
        }`}
      >
        {tunnel.logs.length === 0 ? (
          <span className="text-slate-500">Waiting for output...</span>
        ) : (
          tunnel.logs
            .slice(props.compactLogs ? -16 : -40)
            .map((line, index) => (
              <div
                key={`${tunnel.id}-${index.toString()}`}
                className={
                  line.startsWith("ERROR")
                    ? "text-red-300"
                    : line.startsWith("URL:")
                      ? "text-violet-300"
                      : line.startsWith("$")
                        ? "text-emerald-300"
                        : "text-slate-300"
                }
              >
                {line}
              </div>
            ))
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {isQuickProvisioning ? (
          <button
            type="button"
            className="rounded-md bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-500"
            onClick={props.onRestart}
          >
            Reconnect Quick
          </button>
        ) : null}

        {tunnel.status === "live" ? (
          <button
            type="button"
            className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700"
            onClick={props.onStop}
          >
            Stop
          </button>
        ) : null}

        {tunnel.status === "closed" || tunnel.status === "error" ? (
          <button
            type="button"
            className="rounded-md bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-500"
            onClick={props.onRestart}
          >
            Restart
          </button>
        ) : null}

        <button
          type="button"
          className="rounded-md bg-sky-600/20 px-2 py-1 text-xs text-sky-200 hover:bg-sky-600/30"
          onClick={props.onEdit}
        >
          Edit
        </button>

        <button
          type="button"
          className="rounded-md bg-red-600/20 px-2 py-1 text-xs text-red-300 hover:bg-red-600/30"
          onClick={props.onDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function shouldShowTokenField(
  provider: FormState["provider"],
  cloudflareMode?: FormState["cloudflareMode"],
): boolean {
  if (provider === "ngrok") return true;
  if (provider === "cloudflare") return cloudflareMode === "token";
  return false;
}

function formatUptimeLabel(startedAt: string): string {
  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) {
    return "0s";
  }
  const diff = Math.max(0, Date.now() - started);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hour = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hour}h ${remMin}m`;
}
