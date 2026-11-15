/** Dark card with one percentage drawn as a ring: the single most important figure on a tab. */
export function RingCard({
  title, pct, centerLabel, left, right, note,
}: {
  title: string; pct: number | null; centerLabel: string;
  left: { label: string; value: string }; right: { label: string; value: string }; note?: string;
}) {
  const r = 70, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <section className="card-night flex h-full flex-col p-6">
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      <div className="relative mx-auto my-5 size-[180px]">
        <svg viewBox="0 0 180 180" className="size-full -rotate-90" role="img" aria-label={`${centerLabel}: ${p.toFixed(1)}%`}>
          <circle cx="90" cy="90" r={r} fill="none" stroke="#3a3632" strokeWidth="16" />
          <circle cx="90" cy="90" r={r} fill="none" stroke="#e2605a" strokeWidth="16" strokeLinecap="round"
            strokeDasharray={`${(p / 100) * c} ${c}`} />
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <div className="text-[13px] text-night-muted">{centerLabel}</div>
          <div className="tnum text-[30px] font-semibold tracking-tight">{pct == null ? "—" : `${p.toFixed(1)}%`}</div>
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3">
        {[left, right].map((s) => (
          <div key={s.label}>
            <div className="text-[13px] text-night-muted">{s.label}</div>
            <div className="tnum text-[18px] font-semibold">{s.value}</div>
          </div>
        ))}
      </div>
      {note && <p className="mt-4 text-[12.5px] text-night-muted">{note}</p>}
    </section>
  );
}
