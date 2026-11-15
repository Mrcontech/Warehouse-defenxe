import type { Metadata } from "next";
import { PlugsIcon } from "@phosphor-icons/react/ssr";
import { EtlRunner, type LastRun } from "@/components/etl/EtlRunner";
import { SourcePreview } from "@/components/etl/SourcePreview";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { SimulatedPill } from "@/components/ui/SimulatedPill";
import { isConnectionError, isMissingTable } from "@/lib/db";
import { formatDateTime, formatMs, num } from "@/lib/format";
import { etlOverview, sourcePreviews } from "@/lib/queries/etl";

export const metadata: Metadata = { title: "ETL Pipeline" };

const SYSTEMS: Record<string, string> = { admissions: "Admissions & Records", bursary: "Bursary", exams: "Examinations & Records" };

async function overviewOrNull() {
  try {
    return { data: await etlOverview(), offline: false };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (isMissingTable(e) || code === "ER_BAD_DB_ERROR") return { data: null, offline: false };
    if (isConnectionError(e)) return { data: null, offline: true };
    throw e;
  }
}

/** Shortens a raw rejected record to the fields a reader needs to see why it was refused. */
function example(raw: string) {
  return raw.length > 220 ? raw.slice(0, 220) + "…" : raw;
}

export default async function EtlPage() {
  const { data, offline } = await overviewOrNull();
  const previews = sourcePreviews();
  const lastRun = data?.last ?? null;
  const last: LastRun = {
    runId: lastRun?.run_id ?? null,
    finishedAt: lastRun ? formatDateTime(lastRun.finished_at) : null,
    durationMs: lastRun?.duration_ms ?? null,
    sources: (data?.sources ?? []).map((s) => ({
      source: s.source_name, file: s.file_name, extracted: s.rows_extracted, duplicates: s.rows_duplicate,
      rejected: s.rows_rejected, loaded: s.rows_loaded, cleaned: s.rows_cleaned,
    })),
    rules: (data?.rules ?? []).map((r) => ({ source: r.source_name, rule: r.rule_text, rows: r.rows_affected })),
    tables: (data?.tables ?? []).map((t) => ({ table: t.table_name, rows: t.rows_loaded })),
  };
  const rejects = data?.rejects ?? [];
  const rejectTotal = rejects.reduce((a, r) => a + r.n, 0);

  return (
    <>
      <PageHeader title="ETL Pipeline" crumbs={[{ label: "Warehouse" }, { label: "ETL Pipeline" }]} right={<SimulatedPill />} />
      {offline && (
        <p className="mt-5 flex items-start gap-2 rounded-[14px] bg-bad-soft px-4 py-3 text-[14px] text-bad">
          <PlugsIcon size={18} className="mt-px shrink-0" />
          MySQL is not running, so the run history cannot be shown and the ETL cannot load. Start MySQL in the XAMPP Control Panel, then refresh this page.
        </p>
      )}
      <div className="mt-6">
        <EtlRunner last={last} />
      </div>
      <div className="mt-4">
        <SourcePreview previews={previews} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4">
        <Card title="Rejected rows"
          subtitle={lastRun ? `${num(rejectTotal)} rows refused in run #${lastRun.run_id}. Each is kept in etl_reject with its reason and the raw record, for the source office to correct.` : "Rows the ETL refuses to load appear here after a run."}>
          {rejects.length === 0 ? (
            <p className="text-[13.5px] text-muted">{lastRun ? "No rows were rejected." : "No run yet."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="w-[170px] py-2 pr-3 font-medium">Source</th>
                    <th className="w-[230px] py-2 pr-3 font-medium">Reason</th>
                    <th className="w-[64px] py-2 pr-4 text-right font-medium">Rows</th>
                    <th className="py-2 font-medium">Example (raw record, as exported)</th>
                  </tr>
                </thead>
                <tbody>
                  {rejects.map((r) => (
                    <tr key={`${r.source_name}-${r.reason}`} className="border-b border-line/70 align-top last:border-0">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-ink-2">{SYSTEMS[r.source_name] ?? r.source_name}</td>
                      <td className="py-2.5 pr-3 font-medium text-ink">{r.reason}</td>
                      <td className="tnum py-2.5 pr-4 text-right text-ink">{num(r.n)}</td>
                      <td className="py-2.5 font-mono text-[11.5px] leading-relaxed break-all text-muted">{example(r.example)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Run history" subtitle="The last ten runs, from etl_run">
          {(data?.runs.length ?? 0) === 0 ? (
            <p className="text-[13.5px] text-muted">No runs recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="py-2 pr-3 font-medium">Run</th>
                    <th className="py-2 pr-3 font-medium">Started</th>
                    <th className="py-2 pr-3 font-medium">By</th>
                    <th className="py-2 pr-3 text-right font-medium">Time</th>
                    <th className="py-2 pr-3 text-right font-medium">Rows loaded</th>
                    <th className="py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {data!.runs.map((r) => (
                    <tr key={r.run_id} className="border-b border-line/70 last:border-0" title={r.message ?? undefined}>
                      <td className="py-2.5 pr-3 font-medium text-ink">#{r.run_id}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-ink-2">{formatDateTime(r.started_at)}</td>
                      <td className="py-2.5 pr-3 text-ink-2">{r.triggered_by}</td>
                      <td className="py-2.5 pr-3 text-right text-ink-2">{formatMs(r.duration_ms)}</td>
                      <td className="py-2.5 pr-3 text-right text-ink-2">{r.loaded != null && r.status === "success" ? num(r.loaded) : "–"}</td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${r.status === "success" ? "bg-good-soft text-good" : r.status === "running" ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad"}`}>
                          {r.status === "success" ? "Success" : r.status === "running" ? "Running" : "Failed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
