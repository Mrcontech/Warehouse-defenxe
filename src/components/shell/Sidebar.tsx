"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowsClockwiseIcon, FlaskIcon, LightbulbIcon, SignOutIcon, SquaresFourIcon, TreeStructureIcon } from "@phosphor-icons/react";
import { LogoMark, Wordmark } from "@/components/ui/LogoMark";
import { logout } from "@/app/(app)/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: SquaresFourIcon },
  { href: "/etl", label: "ETL Pipeline", Icon: ArrowsClockwiseIcon },
  { href: "/schema", label: "Star Schema", Icon: TreeStructureIcon },
  { href: "/about", label: "How It Works", Icon: LightbulbIcon },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function Sidebar({ fullName, username }: { fullName: string; username: string }) {
  const path = usePathname();
  const active = (href: string) => (href === "/dashboard" ? path.startsWith("/dashboard") : path.startsWith(href));
  return (
    <>
      {/* Phones and narrow windows: a compact top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur lg:hidden">
        <span className="hidden min-[460px]:block"><Wordmark /></span>
        <span className="min-[460px]:hidden"><LogoMark size={36} /></span>
        <nav className="ml-auto flex gap-1" aria-label="Main">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-label={label} title={label} aria-current={active(href) ? "page" : undefined}
              className={`press grid size-9 place-items-center rounded-[10px] ${active(href) ? "bg-accent-soft text-accent-ink" : "text-ink-2"}`}>
              <Icon size={18} weight={active(href) ? "fill" : "regular"} />
            </Link>
          ))}
          <form action={logout}>
            <button type="submit" aria-label="Sign out" title="Sign out" className="press grid size-9 place-items-center rounded-[10px] text-ink-2">
              <SignOutIcon size={18} />
            </button>
          </form>
        </nav>
      </header>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
        <div className="px-2">
          <Wordmark />
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink">
            {initials(fullName)}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14px] font-medium text-ink" title={fullName}>{fullName}</div>
            <div className="truncate text-[12.5px] text-muted">Signed in as {username}</div>
          </div>
        </div>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
              className={`press flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14.5px] ${active(href) ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
              <Icon size={19} weight={active(href) ? "fill" : "regular"} />
              {label}
            </Link>
          ))}
          <div className="my-2 border-t border-line" />
          <form action={logout}>
            <button type="submit" className="press flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14.5px] text-ink-2 hover:bg-surface-2 hover:text-ink">
              <SignOutIcon size={19} />
              Sign out
            </button>
          </form>
        </nav>
        <div className="card-night mt-auto p-4">
          <span className="grid size-9 place-items-center rounded-[10px] bg-night-2 text-series-2-dark">
            <FlaskIcon size={18} weight="fill" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">Simulated data</p>
          <p className="mt-1 text-[13px] leading-relaxed text-night-muted">
            Every student, result and payment is generated. No real records are used.
          </p>
          <Link href="/about#data" className="press mt-3 block rounded-[10px] bg-[#fff8f5] px-3 py-2 text-center text-[13.5px] font-medium text-ink">
            About the data
          </Link>
        </div>
      </aside>
    </>
  );
}
