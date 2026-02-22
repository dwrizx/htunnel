export default function HelpRoute() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Help</h1>
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
        <p>This frontend uses:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Vite 8 beta</li>
          <li>React 19 + React Compiler</li>
          <li>React Router</li>
          <li>Tailwind v4</li>
          <li>Zod</li>
          <li>fbtee i18n</li>
        </ul>
      </div>
    </div>
  );
}
