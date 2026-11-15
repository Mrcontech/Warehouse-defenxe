import { CheckCircleIcon, CircleHalfIcon, XCircleIcon } from "@phosphor-icons/react/ssr";

const STYLES = {
  Paid: { cls: "bg-good-soft text-good", Icon: CheckCircleIcon },
  "Part-paid": { cls: "bg-warn-soft text-warn", Icon: CircleHalfIcon },
  Unpaid: { cls: "bg-bad-soft text-bad", Icon: XCircleIcon },
} as const;

export function StatusPill({ status }: { status: string }) {
  const s = STYLES[status as keyof typeof STYLES] ?? { cls: "bg-surface-2 text-muted", Icon: CircleHalfIcon };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium ${s.cls}`}>
      <s.Icon size={14} weight="fill" />
      {status}
    </span>
  );
}
