"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon, CheckCircleIcon, CircleNotchIcon, DatabaseIcon, FunnelIcon, PlayIcon, TrayArrowDownIcon, WarningCircleIcon,
} from "@phosphor-icons/react";

export type SourceCount = { source: string; file: string; extracted: number; duplicates: number; rejected: number; loaded: number; cleaned: number };
export type RuleCount = { source: string; rule: string; rows: number };
export type TableCount = { table: string; rows: number };
export type LastRun = {
  runId: number | null; finishedAt: string | null; durationMs: number | null;
  sources: SourceCount[]; rules: RuleCount[]; tables: TableCount[];
};

type Stage = "extract" | "transform" | "load";
type StageState = "idle" | "active" | "done" | "failed";
type LogLine = { t: number; text: string; tone?: "bad" | "good" };

const SYSTEMS: Record<string, string> = {
  admissions: "Admissions & Records",
  bursary: "Bursary (fees)",
  exams: "Examinations & Records",
};

const STAGES: { key: Stage; title: string; text: string; Icon: typeof DatabaseIcon }[] = [
  { key: "extract", title: "Extract", text: "Read the three CSV exports and the official department list.", Icon: TrayArrowDownIcon },
  { key: "transform", title: "Transform", text: "20 cleaning rules, duplicates removed, untrustworthy rows rejected with a reason.", Icon: FunnelIcon },
  { key: "load", title: "Load", text: "Fill shadow tables, check all 13 foreign keys, swap them in with one atomic RENAME.", Icon: DatabaseIcon },
];

const n = (v: number) => v.toLocaleString("en-NG");
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** The Run ETL button and everything it shows while the run streams in. */
export function EtlRunner({ last }: { last: LastRun }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<Record<Stage, StageState>>(
    last.runId ? { extract: "done", transform: "done", load: "done" } : { extract: "idle", transform: "idle", load: "idle" },
  );
  const [sources, setSources] = useState<SourceCount[]>(last.sources);
  const [extracted, setExtracted] = useState<Record<string, number>>({});
  const [rules, setRules] = useState<RuleCount[]>(last.rules);
  const [tables, setTables] = useState<TableCount[]>(last.tables);
  const [log, setLog] = useState<LogLine[]>([]);
  const [runId, setRunId] = useState<number | null>(last.runId);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [duration, setDuration] = useState<number | null>(last.durationMs);
  const logRef = useRef<HTMLOListElement>(null);

  const push = (line: LogLine) => setLog((l) => [...l, line]);

  // Keep the newest log line in view while the run streams in.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  async function run() {
    setRunning(true);
    setResult(null);
    setLog([]);
    setSources([]);
    setExtracted({});
    setRules([]);
    setTables([]);
    setDuration(null);
    setStages({ extract: "idle", transform: "idle", load: "idle" });
    let current: Stage | null = null;
    let finished = false;
    const fail = (message: string) => {
      finished = true;
      setStages((s) => (current ? { ...s, [current]: "failed" } : s));
      setResult({ ok: false, text: message });
      push({ t: 0, text: message, tone: "bad" });
    };

    try {
      const res = await fetch("/api/etl", { method: "POST" });
      if (!res.body) throw new Error("No response from the server.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let i: number;
        while ((i = buffer.indexOf("\n")) >= 0) {
          const text = buffer.slice(0, i).trim();
          buffer = buffer.slice(i + 1);
          if (!text) continue;
          let e: Record<string, unknown>;
          try { e = JSON.parse(text); } catch { continue; }
          const t = Number(e.t ?? 0);
          switch (e.type) {
            case "run":
              setRunId(Number(e.run_id));
              push({ t, text: `ETL run #${e.run_id} started on ${e.host}/${e.database}` });
              break;
            case "phase": {
              const phase = e.phase as Stage;
              setStages((s) => {
                const next = { ...s };
                if (current) next[current] = "done";
                next[phase] = "active";
                return next;
              });
              current = phase;
              push({ t, text: phase.toUpperCase() });
              break;
            }
            case "extract":
              if (e.source !== "reference") setExtracted((x) => ({ ...x, [String(e.source)]: Number(e.rows) }));
              push({ t, text: `${e.file}: ${n(Number(e.rows))} rows read from ${e.system}` });
              break;
            case "rule":
              setRules((r) => [...r, { source: String(e.source), rule: String(e.rule), rows: Number(e.rows) }]);
              push({ t, text: `${e.source}: ${e.rule} (${n(Number(e.rows))})` });
              break;
            case "source":
              setSources((s) => [...s, e as unknown as SourceCount]);
              break;
            case "table":
              setTables((tb) => [...tb, { table: String(e.table), rows: Number(e.rows) }]);
              push({ t, text: `${e.table}: ${n(Number(e.rows))} rows loaded into the shadow table` });
              break;
            case "log":
              push({ t, text: String(e.message) });
              break;
            case "summary": {
              finished = true;
              const ms = Number(e.duration_ms);
              setDuration(ms);
              setStages({ extract: "done", transform: "done", load: "done" });
              setResult({ ok: true, text: `Finished in ${secs(ms)}. Run #${e.run_id} replaced the warehouse tables; the dashboard now shows the new data.` });
              push({ t, text: `Finished in ${secs(ms)}`, tone: "good" });
              break;
            }
            case "error":
              fail(String(e.message));
              break;
          }
        }
      }
      if (!finished) fail("The connection to the ETL closed before it finished.");
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  // Rows by source: live counts while running, the last run's counts otherwise.
  const rows = (["admissions", "bursary", "exams"] as const).map((key) => {
    const s = sources.find((x) => x.source === key);
    return {
      key, system: SYSTEMS[key], file: s?.file ?? `${key}.csv`,
      extracted: s?.extracted ?? extracted[key], cleaned: s?.cleaned, duplicates: s?.duplicates, rejected: s?.rejected, loaded: s?.loaded,
    };
  });
  const total = (k: "extracted" | "cleaned" | "duplicates" | "rejected" | "loaded") =>
    rows.every((r) => r[k] !== undefined) ? rows.reduce((a, r) => a + (r[k] ?? 0), 0) : undefined;
  const totals = { extracted: total("extracted"), cleaned: total("cleaned"), duplicates: total("duplicates"), rejected: total("rejected"), loaded: total("loaded") };
  const balanced = totals.extracted !== undefined && totals.loaded !== undefined && totals.duplicates !== undefined && totals.rejected !== undefined
    && totals.extracted === totals.loaded + totals.duplicates + totals.rejected;
  const cell = (v: number | undefined) => (v === undefined ? <span className="text-faint">{running ? "…" : "–"}</span> : n(v));

  return (
    <div className="grid grid-cols-1 gap-4">
      <section className="card p-5 sm:p-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">Extract, transform, load</h2>
            <p className="mt-1 max-w-[62ch] text-[13.5px] text-muted">
              Reads the three simulated source exports, cleans them and reloads the warehouse. If anything fails, the
              live tables stay exactly as they were.
            </p>
          </div>
          <button type="button" onClick={run} disabled={running}
            className="press inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-accent px-5 text-[14.5px] font-semibold text-[#fff7f5] hover:bg-accent-ink disabled:cursor-wait disabled:opacity-70">
            {running ? <CircleNotchIcon size={18} weight="bold" className="animate-spin" /> : <PlayIcon size={18} weight="fill" />}
            {running ? "Running…" : "Run ETL"}
          </button>
        </header>

        <ol className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          {STAGES.map((s, i) => {
            const state = stages[s.key];
            const tone = state === "active" ? "border-accent bg-accent-soft" : state === "failed" ? "border-bad bg-bad-soft" : "border-line bg-surface-2";
            return (
              <li key={s.key} className="contents">
                {i > 0 && <span aria-hidden className="hidden place-items-center text-faint md:grid"><ArrowRightIcon size={18} /></span>}
                <div className={`rounded-[14px] border p-4 transition-colors ${tone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2.5">
                      <span className={`grid size-8 place-items-center rounded-[9px] ${state === "active" ? "bg-accent text-[#fff7f5]" : "bg-surface text-ink"}`}>
                        <s.Icon size={17} weight="bold" />
                      </span>
                      <span className="text-[15px] font-semibold text-ink">{i + 1}. {s.title}</span>
                    </span>
                    <StageBadge state={state} />
                  </div>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">{s.text}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {result && (
          <p role="status" className={`mt-4 flex items-start gap-2 rounded-[12px] px-4 py-3 text-[13.5px] ${result.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
            {result.ok ? <CheckCircleIcon size={18} weight="fill" className="mt-px shrink-0" /> : <WarningCircleIcon size={18} weight="fill" className="mt-px shrink-0" />}
            <span>{result.text}</span>
          </p>
        )}

        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-ink">Rows by source</h3>
            <p className="text-[12.5px] text-muted">
              {runId ? `Run #${runId}` : "No run yet"}
              {duration !== null && !running ? ` · ${secs(duration)}` : ""}
              {last.finishedAt && !running && runId === last.runId ? ` · ${last.finishedAt}` : ""}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-2 pr-3 font-medium">Source system</th>
                  <th className="py-2 pr-3 font-medium">File</th>
                  <th className="py-2 pr-3 text-right font-medium">Extracted</th>
                  <th className="py-2 pr-3 text-right font-medium" title="Rows changed by at least one cleaning rule">Cleaned</th>
                  <th className="py-2 pr-3 text-right font-medium">Duplicates</th>
                  <th className="py-2 pr-3 text-right font-medium">Rejected</th>
                  <th className="py-2 text-right font-medium">Loaded</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-line/70">
                    <td className="py-2.5 pr-3 font-medium text-ink">{r.system}</td>
                    <td className="py-2.5 pr-3 font-mono text-[12.5px] text-ink-2">{r.file}</td>
                    <td className="py-2.5 pr-3 text-right text-ink-2">{cell(r.extracted)}</td>
                    <td className="py-2.5 pr-3 text-right text-ink-2">{cell(r.cleaned)}</td>
                    <td className="py-2.5 pr-3 text-right text-ink-2">{cell(r.duplicates)}</td>
                    <td className="py-2.5 pr-3 text-right text-ink-2">{cell(r.rejected)}</td>
                    <td className="py-2.5 text-right font-semibold text-ink">{cell(r.loaded)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2.5 pr-3 font-semibold text-ink" colSpan={2}>Total</td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-ink">{cell(totals.extracted)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-ink">{cell(totals.cleaned)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-ink">{cell(totals.duplicates)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-ink">{cell(totals.rejected)}</td>
                  <td className="py-2.5 text-right font-semibold text-ink">{cell(totals.loaded)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {balanced && (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
              <CheckCircleIcon size={16} weight="fill" className="text-good" />
              Every row is accounted for: {n(totals.extracted!)} extracted = {n(totals.loaded!)} loaded + {n(totals.duplicates!)} duplicates + {n(totals.rejected!)} rejected.
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="card p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">Cleaning rules applied</h2>
          <p className="mt-1 text-[13.5px] text-muted">Rows each rule changed or produced{runId ? ` in run #${runId}` : ""}</p>
          <RuleList rules={rules} running={running} />
        </section>
        <div className="grid grid-cols-1 content-start gap-4">
          <section className="card p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">Tables loaded</h2>
            <p className="mt-1 text-[13.5px] text-muted">Rows in each warehouse table after the swap</p>
            {tables.length === 0 ? (
              <p className="mt-4 text-[13.5px] text-muted">{running ? "Waiting for the load stage…" : "Run the ETL to load the warehouse."}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line/70">
                {tables.map((t) => (
                  <li key={t.table} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                    <span className="flex items-center gap-2 font-mono text-[12.5px] text-ink-2">
                      <span className={`size-2 rounded-full ${t.table.startsWith("fact_") ? "bg-accent" : "bg-series-1"}`} />
                      {t.table}
                    </span>
                    <span className="tnum font-medium text-ink">{n(t.rows)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card-night p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold tracking-tight text-[#fff8f5]">Run log</h2>
            <p className="mt-1 text-[13.5px] text-night-muted">{log.length ? "Events from etl.py, as they happen" : "Press Run ETL to watch the run step by step"}</p>
            <ol ref={logRef} className="mt-3 max-h-[260px] overflow-auto font-mono text-[12px] leading-[1.7]">
              {log.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="tnum w-12 shrink-0 text-right text-night-muted">{l.t ? `${l.t.toFixed(1)}s` : ""}</span>
                  <span className={l.tone === "bad" ? "text-[#f5a29d]" : l.tone === "good" ? "text-[#9ad7ae]" : "text-[#ece6df]"}>{l.text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function StageBadge({ state }: { state: StageState }) {
  if (state === "active") return <span className="flex items-center gap-1 text-[12px] font-medium text-accent-ink"><CircleNotchIcon size={14} weight="bold" className="animate-spin" />Running</span>;
  if (state === "done") return <span className="flex items-center gap-1 text-[12px] font-medium text-good"><CheckCircleIcon size={14} weight="fill" />Done</span>;
  if (state === "failed") return <span className="flex items-center gap-1 text-[12px] font-medium text-bad"><WarningCircleIcon size={14} weight="fill" />Failed</span>;
  return <span className="text-[12px] text-faint">Waiting</span>;
}

function RuleList({ rules, running }: { rules: RuleCount[]; running: boolean }) {
  if (rules.length === 0) {
    return <p className="mt-4 text-[13.5px] text-muted">{running ? "Waiting for the transform stage…" : "No rules recorded yet."}</p>;
  }
  const groups = (["admissions", "bursary", "exams"] as const)
    .map((key) => ({ key, rules: rules.filter((r) => r.source === key) }))
    .filter((g) => g.rules.length);
  return (
    <div className="mt-3 grid grid-cols-1 gap-4">
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className="mb-1 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted">{SYSTEMS[g.key]}</h3>
          <ul className="divide-y divide-line/70">
            {g.rules.map((r, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 py-1.5 text-[13.5px]">
                <span className="text-ink-2">{r.rule}</span>
                <span className="tnum shrink-0 font-medium text-ink">{n(r.rows)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
