import { useLocaleContext } from "fbtee";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocaleContext();

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs">
      <span className="text-slate-400">
        <fbt desc="Language label">Language</fbt>
      </span>
      <select
        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none"
        value={locale}
        onChange={(event) => setLocale(event.target.value)}
      >
        <option value="en_US">English</option>
        <option value="id_ID">Bahasa Indonesia</option>
      </select>
    </div>
  );
}
