export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="16" fill="#211f1d" />
      <rect x="16" y="18" width="32" height="6" rx="3" fill="#fff8f5" />
      <rect x="16" y="29" width="22" height="6" rx="3" fill="#d9443e" />
      <rect x="16" y="40" width="28" height="6" rx="3" fill="#fff8f5" />
    </svg>
  );
}

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={36} />
      <div className="leading-tight">
        <div className={`text-[15px] font-semibold tracking-tight ${dark ? "text-[#fff8f5]" : "text-ink"}`}>EBSU Analytics</div>
        <div className={`text-[12px] ${dark ? "text-night-muted" : "text-muted"}`}>Data warehouse and BI</div>
      </div>
    </div>
  );
}
