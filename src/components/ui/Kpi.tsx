import { ArrowDownRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react/ssr";

/** A headline figure with an optional change on the previous session. */
export function Kpi({
  label, value, unit, delta, good = "up", compare, note,
}: {
  label: string; value: string; unit?: string; delta?: number | null; good?: "up" | "down"; compare?: string; note?: string;
}) {
  const hasDelta = delta != null && Number.isFinite(delta);
  const positive = hasDelta && delta! > 0.05;
  const negative = hasDelta && delta! < -0.05;
  const isGood = (positive && good === "up") || (negative && good === "down");
  const isBad = (negative && good === "up") || (positive && good === "down");
  const tone = isGood ? "bg-good-soft text-good" : isBad ? "bg-bad-soft text-bad" : "bg-surface-2 text-muted";
  return (
    <div className="card p-5">
      <p className="text-[13.5px] text-muted">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="tnum text-[32px] font-semibold leading-none tracking-tight text-ink">{value}</span>
        {unit && <span className="text-[13.5px] text-muted">{unit}</span>}
        {hasDelta && (
          <span className={`tnum inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${tone}`}>
            {delta! >= 0 ? <ArrowUpRightIcon size={12} weight="bold" /> : <ArrowDownRightIcon size={12} weight="bold" />}
            {delta! >= 0 ? "+" : ""}
            {delta!.toFixed(1)}%
          </span>
        )}
      </div>
      {(compare || note) && <p className="mt-2 text-[12.5px] text-muted">{note ?? `vs ${compare}`}</p>}
    </div>
  );
}
