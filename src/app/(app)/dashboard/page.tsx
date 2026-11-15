import type { Metadata } from "next";
import { HBars, Columns, Legend } from "@/components/charts/Charts";
import { COLORS } from "@/components/charts/colors";
import { DashboardFrame } from "@/components/dashboard/DashboardFrame";
import { NotReady } from "@/components/dashboard/NotReady";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { ChartCard } from "@/components/ui/ChartCard";
import { InlineBar } from "@/components/ui/InlineBar";
import { Kpi } from "@/components/ui/Kpi";
import { RingCard } from "@/components/ui/RingCard";
import { dashboardContext } from "@/lib/dashboard";
import { shortFaculty, type SearchParams } from "@/lib/filters";
import { delta, num, pct } from "@/lib/format";
import { enrolmentByLevel, enrolmentBySession, enrolmentByState, enrolmentByUnit, enrolmentKpis, programmes } from "@/lib/queries/overview";

export const metadata: Metadata = { title: "Overview" };

const GENDER = [
  { key: "male", name: "Male", color: COLORS.series1 },
  { key: "female", name: "Female", color: COLORS.series2 },
];

export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await dashboardContext(searchParams);
  if (!ctx.ready) return (<><PageHeader title="Overview" crumbs={[{ label: "Dashboard" }, { label: "Overview" }]} /><NotReady status={ctx.status} /></>);
  const { f, frame, label } = ctx;
  const [kpis, bySession, byUnit, byLevel, byState, progs] = await Promise.all([
    enrolmentKpis(f), enrolmentBySession(f), enrolmentByUnit(f), enrolmentByLevel(f), enrolmentByState(f), programmes(f),
  ]);
  const k = kpis.rows[0];
  const p = kpis.previous;
  const compare = f.previous?.name;
  const femalePct = k.students ? (100 * k.female) / k.students : null;
  const unitName = f.faculty ? "department" : "faculty";
  const stateMax = Math.max(...byState.rows.map((r) => r.students), 1);
  const stateTotal = k.students || 1;

  return (
    <DashboardFrame tab="overview" title="Overview" {...frame}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.75fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 content-start gap-4">
          <Kpi label="Students enrolled" value={num(k.students)} delta={delta(k.students, p?.students)} compare={compare} />
          <Kpi label="New intake" value={num(k.new_intake)} delta={delta(k.new_intake, p?.new_intake)} compare={compare} />
          <Kpi label="Final-year students" value={num(k.final_year)} delta={delta(k.final_year, p?.final_year)} compare={compare} />
        </div>
        <ChartCard title={`Enrolment by ${unitName}`} subtitle={`${label}. Students registered in the session`} sql={byUnit.sql}
          table={{ columns: [unitName === "faculty" ? "Faculty" : "Department", "Students"], align: ["l", "r"], rows: byUnit.rows.map((r) => [r.label, num(r.students)]) }}>
          <HBars data={byUnit.rows.map((r) => ({ label: f.faculty ? r.label : shortFaculty(r.label), students: r.students }))}
            series={[{ key: "students", name: "Students", color: COLORS.series1 }]} labelWidth={f.faculty ? 170 : 128} />
        </ChartCard>
        <RingCard title="Gender ratio" pct={femalePct} centerLabel="Female"
          left={{ label: "Female", value: num(k.female) }} right={{ label: "Male", value: num(k.male) }} note={label} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Enrolment by session" subtitle={`Male and female students per session.${f.session ? ` ${f.session.name} in focus` : ""}`} sql={bySession.sql}
          table={{ columns: ["Session", "Male", "Female", "Total"], align: ["l", "r", "r", "r"], rows: bySession.rows.map((r) => [r.session_name, num(r.male), num(r.female), num(r.total)]) }}>
          <Legend series={GENDER} />
          <Columns data={bySession.rows.map((r) => ({ label: r.session_name, male: r.male, female: r.female, total: r.total }))}
            series={GENDER} stacked totalKey="total" focusLabel={f.session?.name} />
        </ChartCard>
        <ChartCard title="Students by level" subtitle={`${label}. 100 level is the first year`} sql={byLevel.sql}
          table={{ columns: ["Level", "Male", "Female", "Total"], align: ["l", "r", "r", "r"], rows: byLevel.rows.map((r) => [String(r.level), num(r.male), num(r.female), num(r.total)]) }}>
          <Legend series={GENDER} />
          <Columns data={byLevel.rows.map((r) => ({ label: `${r.level}`, male: r.male, female: r.female, total: r.total }))} series={GENDER} stacked totalKey="total" />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Largest programmes" subtitle={label}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-2 pr-3 font-medium">Programme</th>
                  <th className="py-2 pr-3 font-medium">Faculty</th>
                  <th className="py-2 pr-3 text-right font-medium">Students</th>
                  <th className="py-2 pr-3 text-right font-medium">New intake</th>
                  <th className="py-2 text-right font-medium">Female</th>
                </tr>
              </thead>
              <tbody>
                {progs.rows.map((r) => (
                  <tr key={r.department} className="border-b border-line/70 last:border-0">
                    <td className="py-2.5 pr-3 text-ink">{r.degree} {r.department}</td>
                    <td className="py-2.5 pr-3 text-muted">{shortFaculty(r.faculty)}</td>
                    <td className="tnum py-2.5 pr-3 text-right text-ink">{num(r.students)}</td>
                    <td className="tnum py-2.5 pr-3 text-right text-ink-2">{num(r.new_intake)}</td>
                    <td className="tnum py-2.5 text-right text-ink-2">{pct(r.female_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="State of origin" subtitle={`${label}. Top eight states`}>
          <ul className="flex flex-col gap-3">
            {byState.rows.map((r) => (
              <li key={r.state} className="grid grid-cols-[110px_minmax(0,1fr)_86px] items-center gap-3 text-[13.5px]">
                <span className="truncate text-ink">{r.state}</span>
                <InlineBar value={r.students} max={stateMax} color={r.state === "Ebonyi" ? COLORS.series2 : COLORS.series1} />
                <span className="tnum text-right text-ink-2">{num(r.students)} <span className="text-muted">({((100 * r.students) / stateTotal).toFixed(0)}%)</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </DashboardFrame>
  );
}
