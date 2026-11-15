"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { CaretDownIcon, CoinsIcon, FlaskIcon, GraduationCapIcon, UsersThreeIcon } from "@phosphor-icons/react";

const TABS = [
  { key: "overview", href: "/dashboard", label: "Overview", Icon: UsersThreeIcon },
  { key: "finance", href: "/dashboard/finance", label: "Finance", Icon: CoinsIcon },
  { key: "academics", href: "/dashboard/academics", label: "Academics", Icon: GraduationCapIcon },
] as const;

type Option = { value: string; label: string };

function Select({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: Option[]; onChange: (v: string) => void }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
          className="press h-11 w-full min-w-[180px] appearance-none rounded-[12px] border border-line-strong bg-surface pl-3.5 pr-9 text-[14.5px] text-ink outline-none hover:border-faint focus:border-ink">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <CaretDownIcon size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
      </span>
    </label>
  );
}

/** Title, tabs, session and faculty filters, and the "simulated" label shared by the three dashboard tabs. */
export function DashboardFrame({
  tab, title, sessions, faculties, session, faculty, loaded, children,
}: {
  tab: "overview" | "finance" | "academics"; title: string;
  sessions: Option[]; faculties: Option[]; session: string; faculty: string; loaded: string | null; children: React.ReactNode;
}) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const query = (s: string, f: string) => {
    const sp = new URLSearchParams();
    sp.set("session", s);
    if (f) sp.set("faculty", f);
    return `?${sp.toString()}`;
  };
  const go = (s: string, f: string) => start(() => router.push(path + query(s, f), { scroll: false }));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">{title}</h1>
          <nav aria-label="Breadcrumb" className="mt-1 flex items-center gap-2 text-[14px]">
            <Link href="/dashboard" className="text-accent-ink hover:underline">Dashboard</Link>
            <span className="text-faint">/</span>
            <span className="text-muted">{title}</span>
          </nav>
        </div>
        <nav aria-label="Dashboard tabs" className="flex flex-wrap gap-2">
          {TABS.map(({ key, href, label, Icon }) => (
            <Link key={key} href={href + query(session, faculty)} aria-current={tab === key ? "page" : undefined}
              className={`press inline-flex h-11 items-center gap-2 rounded-[12px] border px-4 text-[14.5px] font-medium ${tab === key ? "border-night bg-night text-[#fff8f5]" : "border-line-strong bg-surface text-ink hover:border-faint"}`}>
              <Icon size={18} weight={tab === key ? "fill" : "regular"} />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap gap-3">
          <Select id="session" label="Session" value={session} options={sessions} onChange={(v) => go(v, faculty)} />
          <Select id="faculty" label="Faculty" value={faculty} options={[{ value: "", label: "All faculties" }, ...faculties]} onChange={(v) => go(session, v)} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
          {loaded && <span>{loaded}</span>}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 font-medium text-accent-ink">
            <FlaskIcon size={14} weight="fill" />
            Simulated data
          </span>
        </div>
      </div>

      <div aria-busy={pending} className={`transition-opacity duration-150 ${pending ? "pointer-events-none opacity-55" : ""}`}>
        {children}
      </div>
    </div>
  );
}
