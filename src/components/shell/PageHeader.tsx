import Link from "next/link";

export function PageHeader({
  title, crumbs, right,
}: { title: string; crumbs: { label: string; href?: string }[]; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">{title}</h1>
        <nav aria-label="Breadcrumb" className="mt-1 flex items-center gap-2 text-[14px]">
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-2">
              {i > 0 && <span className="text-faint">/</span>}
              {c.href ? <Link href={c.href} className="text-accent-ink hover:underline">{c.label}</Link> : <span className="text-muted">{c.label}</span>}
            </span>
          ))}
        </nav>
      </div>
      {right}
    </div>
  );
}
