import { FlaskIcon } from "@phosphor-icons/react/ssr";

export function SimulatedPill() {
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-accent-soft px-3 py-1 text-[13px] font-medium text-accent-ink">
      <FlaskIcon size={14} weight="fill" />
      Simulated data
    </span>
  );
}
