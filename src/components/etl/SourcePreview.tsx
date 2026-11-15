"use client";

import { useState } from "react";
import { ExamIcon, IdentificationCardIcon, MoneyIcon } from "@phosphor-icons/react";

type Cell = { v: string; messy: boolean };
export type Preview = { source: string; file: string; system: string; columns: string[]; bytes: number; rows: Cell[][] };

const ICONS = { admissions: IdentificationCardIcon, bursary: MoneyIcon, exams: ExamIcon } as const;

function show(v: string) {
  if (v === "") return <span className="italic text-faint">empty</span>;
  // Make leading, trailing and doubled spaces visible: they are one of the problems the ETL fixes.
  if (/^\s|\s$|\s{2}/.test(v)) return <>{v.split("").map((ch, i) => (ch === " " ? <span key={i} className="text-accent">␣</span> : ch))}</>;
  return v;
}

/** The raw CSV rows as each source system exports them, with the cells the ETL has to fix highlighted. */
export function SourcePreview({ previews }: { previews: Preview[] }) {
  const [active, setActive] = useState(previews[0]?.source ?? "admissions");
  const p = previews.find((x) => x.source === active) ?? previews[0];
  return (
    <section className="card p-5 sm:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">What the source systems send</h2>
          <p className="mt-1 max-w-[70ch] text-[13.5px] text-muted">
            The first rows of each simulated export, untouched. Each system keys a student differently and has its own
            habits; <mark className="rounded-[4px] bg-accent-soft px-1 text-accent-ink">highlighted cells</mark> are ones the ETL standardises or rejects.
          </p>
        </div>
        <div role="tablist" aria-label="Source file" className="flex shrink-0 flex-wrap gap-1 rounded-[12px] border border-line bg-surface-2 p-1">
          {previews.map((x) => {
            const Icon = ICONS[x.source as keyof typeof ICONS] ?? ExamIcon;
            const on = x.source === active;
            return (
              <button key={x.source} type="button" role="tab" aria-selected={on} onClick={() => setActive(x.source)}
                className={`press flex items-center gap-2 rounded-[9px] px-3 py-1.5 text-[13px] font-medium ${on ? "bg-surface text-ink shadow-[0_1px_2px_rgba(31,29,27,0.08)]" : "text-muted hover:text-ink"}`}>
                <Icon size={16} weight={on ? "bold" : "regular"} />
                {x.file}
              </button>
            );
          })}
        </div>
      </header>
      {p && p.rows.length > 0 ? (
        <>
          <p className="mt-4 text-[12.5px] text-muted">
            {p.system} · {p.columns.length} columns · {(p.bytes / 1_048_576).toFixed(1)} MB
          </p>
          <div className="mt-2 overflow-x-auto rounded-[12px] border border-line">
            <table className="w-full whitespace-nowrap font-mono text-[12px]">
              <thead className="bg-surface-2">
                <tr className="text-left text-muted">
                  {p.columns.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r, j) => (
                  <tr key={j} className="border-t border-line/70">
                    {r.map((c, i) => (
                      <td key={i} className={`px-3 py-1.5 ${c.messy ? "bg-accent-soft text-accent-ink" : "text-ink-2"}`}>{show(c.v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mt-4 text-[13.5px] text-muted">The source files are missing. Run <code className="font-mono">npm run generate-data</code>.</p>
      )}
    </section>
  );
}
