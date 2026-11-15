export function Card({
  title, subtitle, action, children, className = "", dark = false, id,
}: {
  title?: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
  className?: string; dark?: boolean; id?: string;
}) {
  return (
    <section id={id} className={`${dark ? "card-night" : "card"} p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className={`text-[17px] font-semibold tracking-tight ${dark ? "text-[#fff8f5]" : "text-ink"}`}>{title}</h2>}
            {subtitle && <p className={`mt-1 text-[13.5px] ${dark ? "text-night-muted" : "text-muted"}`}>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
