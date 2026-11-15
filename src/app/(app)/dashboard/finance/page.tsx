import type { Metadata } from "next";
import { Columns, HBars, Legend, TrendArea } from "@/components/charts/Charts";
import { COLORS } from "@/components/charts/colors";
import { DashboardFrame } from "@/components/dashboard/DashboardFrame";
import { NotReady } from "@/components/dashboard/NotReady";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { ChartCard } from "@/components/ui/ChartCard";
import { Kpi } from "@/components/ui/Kpi";
import { RingCard } from "@/components/ui/RingCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { dashboardContext } from "@/lib/dashboard";
import { shortFaculty, type SearchParams } from "@/lib/filters";
import { delta, naira, num, pct } from "@/lib/format";
import { feesByItem, feesBySession, feesByUnit, financeKpis, monthlyCollections, outstandingByProgramme, paymentStatus } from "@/lib/queries/finance";

export const metadata: Metadata = { title: "Finance" };

const MONEY = [
  { key: "paid", name: "Collected", color: COLORS.series1 },
  { key: "outstanding", name: "Outstanding", color: COLORS.series2 },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await dashboardContext(searchParams);
  if (!ctx.ready) return (<><PageHeader title="Finance" crumbs={[{ label: "Dashboard" }, { label: "Finance" }]} /><NotReady status={ctx.status} /></>);
  const { f, frame, label } = ctx;
  const [kpis, byUnit, bySession, byItem, status, monthly, owing] = await Promise.all([
    financeKpis(f), feesByUnit(f), feesBySession(f), feesByItem(f), paymentStatus(f), monthlyCollections(f), outstandingByProgramme(f),
  ]);
  const k = kpis.rows[0];
  const p = kpis.previous;
  const compare = f.previous?.name;
  const rate = k.billed ? (100 * k.paid) / k.billed : null;
  const invoices = status.rows.reduce((a, r) => a + r.invoices, 0) || 1;
  const unitName = f.faculty ? "department" : "faculty";

  return (
    <DashboardFrame tab="finance" title="Finance" {...frame}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.75fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 content-start gap-4">
          <Kpi label="Fees billed" value={naira(k.billed)} delta={delta(k.billed, p?.billed)} compare={compare} />
          <Kpi label="Fees collected" value={naira(k.paid)} delta={delta(k.paid, p?.paid)} compare={compare} />
          <Kpi label="Outstanding" value={naira(k.outstanding)} delta={delta(k.outstanding, p?.outstanding)} good="down" compare={compare} />
        </div>
        <ChartCard title={`Collected and outstanding by ${unitName}`} subtitle={`${label}. Sorted by amount outstanding`} sql={byUnit.sql}
          table={{ columns: [unitName === "faculty" ? "Faculty" : "Department", "Billed", "Collected", "Outstanding", "Rate"], align: ["l", "r", "r", "r", "r"],
            rows: byUnit.rows.map((r) => [r.label, naira(r.billed), naira(r.paid), naira(r.outstanding), pct(r.billed ? (100 * r.paid) / r.billed : null)]) }}>
          <Legend series={MONEY} />
          <HBars data={byUnit.rows.map((r) => ({ label: f.faculty ? r.label : shortFaculty(r.label), paid: r.paid, outstanding: r.outstanding }))}
            series={MONEY} stacked format="naira" endKey="outstanding" endSuffix=" owed" labelWidth={f.faculty ? 170 : 128} />
        </ChartCard>
        <RingCard title="Collection rate" pct={rate} centerLabel="Collected"
          left={{ label: "Collected", value: naira(k.paid) }} right={{ label: "Outstanding", value: naira(k.outstanding) }} note={label} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <ChartCard title="Fees by session" subtitle={`Collected and outstanding per session.${f.session ? ` ${f.session.name} in focus` : ""}`} sql={bySession.sql}
          table={{ columns: ["Session", "Billed", "Collected", "Outstanding", "Rate"], align: ["l", "r", "r", "r", "r"],
            rows: bySession.rows.map((r) => [r.session_name, naira(r.billed), naira(r.paid), naira(r.outstanding), pct((100 * r.paid) / r.billed)]) }}>
          <Legend series={MONEY} />
          <Columns data={bySession.rows.map((r) => ({ label: r.session_name, paid: r.paid, outstanding: r.outstanding, billed: r.billed }))}
            series={MONEY} stacked totalKey="billed" format="naira" axisFormat="naira" focusLabel={f.session?.name} />
        </ChartCard>
        <Card title="Payment status" subtitle={`${num(invoices)} fee invoices, ${label}`}>
          <ul className="flex flex-col">
            {status.rows.map((r) => (
              <li key={r.payment_status} className="flex items-center justify-between gap-3 border-b border-line py-3.5 last:border-0">
                <div className="flex items-center gap-3">
                  <StatusPill status={r.payment_status} />
                  <span className="tnum text-[14px] text-ink-2"><b className="font-semibold text-ink">{num(r.invoices)}</b> invoices, {pct((100 * r.invoices) / invoices)}</span>
                </div>
                <div className="text-right">
                  <div className="tnum text-[15px] font-semibold text-ink">{naira(r.payment_status === "Paid" ? r.paid : r.outstanding)}</div>
                  <div className="text-[12.5px] text-muted">{r.payment_status === "Paid" ? "collected" : "outstanding"}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-[12px] bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
            From 2023/2024 school fees may be paid in two instalments, so many part-paid invoices are students who have paid the first half.
          </p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly collections" subtitle={`Money received each month, ${label}`} sql={monthly.sql}
          table={{ columns: ["Month", "Collected"], align: ["l", "r"], rows: monthly.rows.map((r) => [r.month, naira(r.paid)]) }}>
          <TrendArea data={monthly.rows.map((r) => ({ label: `${MONTHS[Number(r.month.slice(5, 7)) - 1]} ${r.month.slice(2, 4)}`, paid: r.paid }))}
            series={{ key: "paid", name: "Collected", color: COLORS.series1 }} />
        </ChartCard>
        <ChartCard title="By fee item" subtitle={`${label}. Acceptance fees are billed to new students only`} sql={byItem.sql}
          table={{ columns: ["Fee item", "Invoices", "Billed", "Collected", "Rate"], align: ["l", "r", "r", "r", "r"],
            rows: byItem.rows.map((r) => [r.fee_item, num(r.invoices), naira(r.billed), naira(r.paid), pct((100 * r.paid) / r.billed)]) }}>
          <Legend series={MONEY} />
          <HBars data={byItem.rows.map((r) => ({ label: r.fee_item, paid: r.paid, outstanding: r.outstanding }))}
            series={MONEY} stacked format="naira" endKey="outstanding" endSuffix=" owed" labelWidth={128} />
        </ChartCard>
      </div>

      <Card title="Programmes owing the most" subtitle={label} className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 pr-3 font-medium">Programme</th>
                <th className="py-2 pr-3 font-medium">Faculty</th>
                <th className="py-2 pr-3 text-right font-medium">Billed</th>
                <th className="py-2 pr-3 text-right font-medium">Outstanding</th>
                <th className="py-2 pr-3 text-right font-medium">Collection rate</th>
                <th className="py-2 text-right font-medium">Students owing</th>
              </tr>
            </thead>
            <tbody>
              {owing.rows.map((r) => (
                <tr key={r.department} className="border-b border-line/70 last:border-0">
                  <td className="py-2.5 pr-3 text-ink">{r.department}</td>
                  <td className="py-2.5 pr-3 text-muted">{shortFaculty(r.faculty)}</td>
                  <td className="tnum py-2.5 pr-3 text-right text-ink-2">{naira(r.billed)}</td>
                  <td className="tnum py-2.5 pr-3 text-right font-medium text-accent-ink">{naira(r.outstanding)}</td>
                  <td className="tnum py-2.5 pr-3 text-right text-ink-2">{pct((100 * r.paid) / r.billed)}</td>
                  <td className="tnum py-2.5 text-right text-ink-2">{num(r.debtors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardFrame>
  );
}
