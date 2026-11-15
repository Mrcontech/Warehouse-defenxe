"use client";

import { useState } from "react";
import { ChartBarIcon, CodeIcon, TableIcon } from "@phosphor-icons/react";

export type TableView = { columns: string[]; rows: (string | number)[][]; align?: ("l" | "r")[] };

const VIEWS = [
  { key: "chart", label: "Chart", Icon: ChartBarIcon },
  { key: "table", label: "Table", Icon: TableIcon },
  { key: "sql", label: "SQL", Icon: CodeIcon },
] as const;

/** A chart with two other views of the same numbers: a table, and the SQL query that produced them. */
export function ChartCard({
  title, subtitle, sql, table, children, footnote, className = "",
}: {
  title: string; subtitle?: string; sql: string; table: TableView; children: React.ReactNode; footnote?: React.ReactNode; className?: string;
}) {
  const [view, setView] = useState<"chart" | "table" | "sql">("chart");
  return (
    <section className={`card flex flex-col p-5 sm:p-6 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p>}
        </div>
        <div role="tablist" aria-label={`${title}: view`} className="flex shrink-0 rounded-[12px] border border-line bg-surface-2 p-0.5">
          {VIEWS.map(({ key, label, Icon }) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} aria-label={label} title={label}
              onClick={() => setView(key)}
              className={`press grid size-8 place-items-center rounded-[10px] ${view === key ? "bg-surface text-ink shadow-[0_1px_2px_rgba(31,29,27,0.08)]" : "text-muted hover:text-ink"}`}>
              <Icon size={16} weight={view === key ? "bold" : "regular"} />
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {view === "chart" && children}
        {view === "table" && (
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-line text-left text-muted">
                  {table.columns.map((c, i) => (
                    <th key={c} className={`py-2 pr-3 font-medium ${table.align?.[i] === "r" ? "text-right" : ""}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, j) => (
                  <tr key={j} className="border-b border-line/70 last:border-0">
                    {r.map((v, i) => (
                      <td key={i} className={`tnum py-2 pr-3 text-ink-2 ${table.align?.[i] === "r" ? "text-right" : ""}`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {view === "sql" && (
          <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-[12px] bg-night p-4 font-mono text-[12.5px] leading-relaxed text-[#ece6df]">
            {sql}
          </pre>
        )}
      </div>
      {footnote && view === "chart" && <p className="mt-3 text-[12.5px] text-muted">{footnote}</p>}
    </section>
  );
}
