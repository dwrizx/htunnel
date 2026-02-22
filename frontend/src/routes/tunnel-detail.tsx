import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { type TunnelItem } from "../lib/api";

export default function TunnelDetailRoute() {
  const { id } = useParams();
  const [tunnel, setTunnel] = useState<TunnelItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    const source = new EventSource(`/api/v1/tunnels/${id}/events`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          tunnel: TunnelItem | null;
          notFound: boolean;
        };
        if (payload.notFound) {
          setTunnel(null);
          setError("Tunnel not found");
          return;
        }
        setTunnel(payload.tunnel);
        setError("");
      } catch {
        setError("Failed to parse realtime tunnel data");
      }
    };
    source.onerror = () => {
      setError("Realtime stream disconnected. Reconnecting...");
    };

    return () => source.close();
  }, [id]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Tunnel detail</h1>
        <Link
          to="/"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          Back
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {tunnel ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-3">
            <h2 className="text-lg font-medium text-slate-100">
              {tunnel.config.name}
            </h2>
            <p className="text-xs text-slate-500">
              {tunnel.config.provider} • {tunnel.config.localHost}:
              {tunnel.config.localPort} • {tunnel.status}
            </p>
          </div>

          {tunnel.urls.length > 0 ? (
            <div className="mb-3 space-y-1">
              {tunnel.urls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-violet-300"
                >
                  {url}
                </a>
              ))}
            </div>
          ) : null}

          <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-800 bg-black/40 p-3 font-mono text-[12px]">
            {tunnel.logs.length === 0 ? (
              <span className="text-slate-500">Waiting for logs...</span>
            ) : (
              tunnel.logs.map((line, index) => (
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
        </section>
      ) : null}
    </div>
  );
}
