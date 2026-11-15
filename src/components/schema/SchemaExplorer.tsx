"use client";

import { useMemo, useState } from "react";
import type { SchemaColumn, SchemaTable } from "@/lib/queries/schema";

type Mode = "all" | "fact_enrolment" | "fact_fee_payment" | "fact_result";
type Box = { t: SchemaTable; x: number; y: number; w: number; h: number; side: "left" | "center" | "right" };

const MODES: { key: Mode; label: string }[] = [
  { key: "all", label: "All three stars" },
  { key: "fact_enrolment", label: "Enrolment star" },
  { key: "fact_fee_payment", label: "Fee payment star" },
  { key: "fact_result", label: "Result star" },
];

const W = 1060, DIM_W = 250, FACT_W = 272, HEADER = 48, ROW = 20, PAD = 10, GAP = 26;
const LEFT = ["dim_student", "dim_course"];
const RIGHT = ["dim_session", "dim_department", "dim_faculty"];
const n = (v: number) => v.toLocaleString("en-NG");
const height = (t: SchemaTable) => HEADER + t.columns.length * ROW + PAD;

function layout(tables: SchemaTable[], mode: Mode) {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const facts = mode === "all" ? tables.filter((t) => t.kind === "fact") : [byName.get(mode)].filter((t): t is SchemaTable => !!t);
  const used = new Set(facts.flatMap((f) => f.columns.map((c) => c.references).filter((r): r is string => !!r)));
  const pick = (names: string[]) => names.filter((x) => used.has(x)).map((x) => byName.get(x)).filter((t): t is SchemaTable => !!t);
  const left = pick(LEFT), right = pick(RIGHT);
  const colH = (list: SchemaTable[]) => list.reduce((a, t) => a + height(t), 0) + GAP * Math.max(list.length - 1, 0);
  const H = Math.max(colH(left), colH(facts), colH(right));
  const place = (list: SchemaTable[], x: number, w: number, side: Box["side"]) => {
    let y = (H - colH(list)) / 2;
    return list.map((t) => {
      const b = { t, x, y, w, h: height(t), side };
      y += b.h + GAP;
      return b;
    });
  };
  const boxes = [...place(left, 0, DIM_W, "left"), ...place(facts, (W - FACT_W) / 2, FACT_W, "center"), ...place(right, W - DIM_W, DIM_W, "right")];
  const at = new Map(boxes.map((b) => [b.t.name, b]));
  const edges: { id: string; from: string; to: string; d: string }[] = [];
  for (const b of boxes.filter((x) => x.side === "center")) {
    b.t.columns.forEach((c, i) => {
      const target = c.references ? at.get(c.references) : undefined;
      if (!target) return;
      const pk = Math.max(target.t.columns.findIndex((tc) => tc.key === "PK"), 0);
      const y1 = b.y + HEADER + i * ROW + ROW / 2;
      const y2 = target.y + HEADER + pk * ROW + ROW / 2;
      const toLeft = target.side === "left";
      const x1 = toLeft ? b.x : b.x + b.w;
      const x2 = toLeft ? target.x + target.w : target.x;
      const k = toLeft ? -70 : 70;
      edges.push({ id: `${b.t.name}.${c.name}`, from: b.t.name, to: target.t.name, d: `M ${x1} ${y1} C ${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}` });
    });
  }
  return { H, boxes, edges };
}

function KeyBadge({ k }: { k: SchemaColumn["key"] }) {
  if (!k) return null;
  const cls = k === "PK" ? "bg-ink text-[#fff8f5]" : k === "FK" ? "bg-accent-soft text-accent-ink" : "bg-[#e3edf6] text-series-1";
  return <span className={`rounded-[5px] px-1 py-px font-sans text-[9.5px] font-semibold tracking-wide ${cls}`}>{k}</span>;
}

// Plain-language meanings for columns the database catalogue has no comment for.
const MEANING: Record<string, string> = {
  faculty_code: "Short code of the faculty, e.g. FSC",
  faculty_name: "Official name of the faculty",
  department_code: "Short code of the programme, e.g. CSC",
  department_name: "Official name of the programme",
  degree_awarded: "Degree awarded, e.g. B.Sc., B.Eng., LL.B.",
  programme_years: "Length of the programme in years",
  start_year: "First calendar year of the session",
  end_year: "Second calendar year of the session",
  is_current: "1 for the latest session in the warehouse",
  surname: "Simulated surname",
  first_name: "Simulated first name",
  middle_name: "Simulated middle name (may be empty)",
  full_name: "Surname, first name and middle name",
  gender: "Male or Female",
  date_of_birth: "Simulated date of birth",
  state_of_origin: "State of origin",
  admission_session: "Session in which the student was admitted",
  course_code: "Course code, e.g. CSC 301",
  course_title: "Course title",
  course_level: "100 to 600, read from the course code",
  amount_billed: "Naira billed for this fee item",
  amount_paid: "Naira paid so far",
  payment_channel: "Remita card, bank branch or USSD, or bank transfer",
  payment_date: "Date of the last payment (NULL if nothing was paid)",
  grade: "Letter grade, A to F",
  credit_units: "Credit units of the course",
  is_pass: "1 if total_score is 40 or more",
};

function meaning(c: SchemaColumn) {
  if (c.comment) return c.comment;
  if (c.references) return `Points to ${c.references}`;
  if (c.key === "PK") return "Surrogate key, assigned by the ETL";
  return MEANING[c.name] ?? "";
}

function cellText(v: unknown) {
  if (v === null || v === undefined) return <span className="text-faint">NULL</span>;
  return String(v);
}

/** The galaxy schema drawn from information_schema, with each table's columns, keys, grain and sample rows. */
export function SchemaExplorer({ tables }: { tables: SchemaTable[] }) {
  const [mode, setMode] = useState<Mode>("all");
  const [selected, setSelected] = useState<string>("fact_result");
  const [hover, setHover] = useState<string | null>(null);
  const { H, boxes, edges } = useMemo(() => layout(tables, mode), [tables, mode]);
  const focus = hover ?? selected;
  const table = tables.find((t) => t.name === selected) ?? tables[0];
  const fkCount = tables.reduce((a, t) => a + t.columns.filter((c) => c.key === "FK").length, 0);
  const joins = table ? (table.kind === "fact"
    ? table.columns.filter((c) => c.references).map((c) => `${c.name} → ${c.references}`)
    : tables.filter((t) => t.kind === "fact" && t.columns.some((c) => c.references === table.name)).map((t) => `${t.name} joins here`)) : [];

  function choose(m: Mode) {
    setMode(m);
    if (m !== "all") setSelected(m);
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <section className="card p-5 sm:p-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">Galaxy schema: three stars, five shared dimensions</h2>
            <p className="mt-1 max-w-[72ch] text-[13.5px] text-muted">
              Read live from the database&apos;s own catalogue (information_schema). {tables.filter((t) => t.kind === "fact").length} fact
              tables, {tables.filter((t) => t.kind === "dimension").length} conformed dimensions, {fkCount} foreign keys. Click a table to see its grain,
              columns and first rows.
            </p>
          </div>
          <div role="tablist" aria-label="Which star" className="flex shrink-0 flex-wrap gap-1 rounded-[12px] border border-line bg-surface-2 p-1">
            {MODES.map((m) => (
              <button key={m.key} type="button" role="tab" aria-selected={mode === m.key} onClick={() => choose(m.key)}
                className={`press rounded-[9px] px-3 py-1.5 text-[13px] font-medium ${mode === m.key ? "bg-surface text-ink shadow-[0_1px_2px_rgba(31,29,27,0.08)]" : "text-muted hover:text-ink"}`}>
                {m.label}
              </button>
            ))}
          </div>
        </header>

        <div className="mt-5 overflow-x-auto pb-2">
          <div className="relative mx-auto" style={{ width: W, height: H }}>
            <svg className="pointer-events-none absolute inset-0" width={W} height={H} aria-hidden>
              {edges.filter((e) => !(e.from === focus || e.to === focus)).map((e) => (
                <path key={e.id} d={e.d} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.5} />
              ))}
              {edges.filter((e) => e.from === focus || e.to === focus).map((e) => (
                <path key={e.id} d={e.d} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
              ))}
            </svg>
            {boxes.map((b) => {
              const isFact = b.t.kind === "fact";
              const on = b.t.name === selected;
              return (
                <button key={b.t.name} type="button" onClick={() => setSelected(b.t.name)}
                  onMouseEnter={() => setHover(b.t.name)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(b.t.name)} onBlur={() => setHover(null)}
                  aria-pressed={on} aria-label={`${b.t.name}, ${b.t.kind}, ${n(b.t.rows)} rows`}
                  className={`absolute overflow-hidden rounded-[14px] border bg-surface text-left transition-shadow ${on ? "border-ink shadow-[0_6px_18px_rgba(31,29,27,0.12)]" : "border-line-strong hover:shadow-[0_4px_14px_rgba(31,29,27,0.08)]"}`}
                  style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
                  <div className={`flex items-center justify-between gap-2 border-b px-3 ${isFact ? "border-accent-tint bg-accent-soft" : "border-line bg-surface-2"}`} style={{ height: HEADER }}>
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[13px] font-semibold text-ink">{b.t.name}</span>
                      <span className={`block text-[10.5px] font-semibold uppercase tracking-[0.08em] ${isFact ? "text-accent-ink" : "text-series-1"}`}>{isFact ? "Fact" : "Dimension"}</span>
                    </span>
                    <span className="tnum shrink-0 text-[11.5px] text-muted">{n(b.t.rows)} rows</span>
                  </div>
                  <ul className="px-3 pt-1">
                    {b.t.columns.map((c) => (
                      <li key={c.name} className="flex items-center justify-between gap-2 font-mono text-[11.5px]" style={{ height: ROW }}>
                        <span className={`flex min-w-0 items-center gap-1.5 ${c.key === "PK" ? "font-semibold text-ink" : "text-ink-2"}`}>
                          <span className="truncate">{c.name}</span>
                          <KeyBadge k={c.key} />
                        </span>
                        <span className="shrink-0 text-[10.5px] text-faint">{c.type.replace(" unsigned", "")}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
          <span className="flex items-center gap-1.5"><KeyBadge k="PK" /> primary key (surrogate key set by the ETL)</span>
          <span className="flex items-center gap-1.5"><KeyBadge k="FK" /> foreign key to a dimension</span>
          <span className="flex items-center gap-1.5"><KeyBadge k="NK" /> natural key from the source system</span>
        </div>
      </section>

      {table && (
        <section className="card p-5 sm:p-6" aria-live="polite">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className={`text-[11.5px] font-semibold uppercase tracking-[0.08em] ${table.kind === "fact" ? "text-accent-ink" : "text-series-1"}`}>
                {table.kind === "fact" ? "Fact table" : "Dimension table"}
              </p>
              <h2 className="mt-1 font-mono text-[20px] font-semibold tracking-tight text-ink">{table.name}</h2>
              <p className="mt-1 max-w-[80ch] text-[13.5px] text-ink-2"><span className="font-semibold">Grain:</span> {table.grain}</p>
              {table.comment && <p className="mt-1 max-w-[80ch] text-[13px] text-muted">{table.comment}</p>}
            </div>
            <div className="flex shrink-0 gap-6 sm:text-right">
              <div><p className="tnum text-[22px] font-semibold text-ink">{n(table.rows)}</p><p className="text-[12.5px] text-muted">rows</p></div>
              <div><p className="tnum text-[22px] font-semibold text-ink">{table.columns.length}</p><p className="text-[12.5px] text-muted">columns</p></div>
            </div>
          </header>
          {joins.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {joins.map((j) => <li key={j} className="rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-[12px] text-ink-2">{j}</li>)}
            </ul>
          )}
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <div className="overflow-x-auto">
              <h3 className="mb-2 text-[15px] font-semibold text-ink">Columns</h3>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="py-2 pr-3 font-medium">Column</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((c) => (
                    <tr key={c.name} className="border-b border-line/70 align-top last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap"><span className="flex items-center gap-1.5 font-mono text-[12.5px] text-ink">{c.name}<KeyBadge k={c.key} /></span></td>
                      <td className="py-2 pr-3 whitespace-nowrap font-mono text-[12px] text-muted">{c.type}</td>
                      <td className="py-2 text-ink-2">{meaning(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="min-w-0">
              <h3 className="mb-2 text-[15px] font-semibold text-ink">First rows <span className="font-normal text-muted">(simulated)</span></h3>
              <div className="overflow-x-auto rounded-[12px] border border-line">
                <table className="w-full whitespace-nowrap font-mono text-[11.5px]">
                  <thead className="bg-surface-2">
                    <tr className="text-left text-muted">{table.columns.map((c) => <th key={c.name} className="px-3 py-2 font-medium">{c.name}</th>)}</tr>
                  </thead>
                  <tbody>
                    {table.sample.map((r, i) => (
                      <tr key={i} className="border-t border-line/70">
                        {table.columns.map((c) => <td key={c.name} className="px-3 py-1.5 text-ink-2">{cellText(r[c.name])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
