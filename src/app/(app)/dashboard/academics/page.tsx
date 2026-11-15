import type { Metadata } from "next";
import { Columns, HBars, TrendLine } from "@/components/charts/Charts";
import { COLORS } from "@/components/charts/colors";
import { DashboardFrame } from "@/components/dashboard/DashboardFrame";
import { NotReady } from "@/components/dashboard/NotReady";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { ChartCard } from "@/components/ui/ChartCard";
import { Kpi } from "@/components/ui/Kpi";
import { RingCard } from "@/components/ui/RingCard";
import { dashboardContext } from "@/lib/dashboard";
import { shortFaculty, type SearchParams } from "@/lib/filters";
import { dec1, dec2, delta, num, pct } from "@/lib/format";
import { DEGREE_CLASSES, academicKpis, cgpaDistribution, gradeDistribution, hardestCourses, passRateBySession, passRateByUnit } from "@/lib/queries/academics";

export const metadata: Metadata = { title: "Academics" };

export default async function AcademicsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await dashboardContext(searchParams);
  if (!ctx.ready) return (<><PageHeader title="Academics" crumbs={[{ label: "Dashboard" }, { label: "Academics" }]} /><NotReady status={ctx.status} /></>);
  const { f, frame, label } = ctx;
  const [kpis, cgpa, byUnit, grades, hardest, bySession] = await Promise.all([
    academicKpis(f), cgpaDistribution(f), passRateByUnit(f), gradeDistribution(f), hardestCourses(f), passRateBySession(f),
  ]);
  const k = kpis.rows[0];
  const p = kpis.previous;
  const first = cgpa.rows.find((r) => r.cls === "First")?.students ?? 0;
  const passRate = k.results ? (100 * k.passed) / k.results : null;
  const unitName = f.faculty ? "department" : "faculty";
  const upTo = f.session ? `CGPA up to ${f.session.name}` : "CGPA over all sessions";

  return (
    <DashboardFrame tab="academics" title="Academics" {...frame}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.75fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 content-start gap-4">
          <Kpi label={f.session ? "Average GPA this session" : "Average GPA"} value={dec2(k.gpa)} unit="of 5.00" delta={delta(k.gpa, p?.gpa)} compare={f.previous?.name} />
          <Kpi label="First Class students" value={num(first)} unit={cgpa.total ? pct((100 * first) / cgpa.total) : undefined}
            note={`CGPA of 4.50 or more, of ${num(cgpa.total)} students`} />
          <Kpi label="Course results processed" value={num(k.results)} note={`${num(k.students)} students, average score ${dec1(k.avg_score)}`} />
        </div>
        <ChartCard title="CGPA distribution" subtitle={`Students by degree class, ${upTo}. Mean CGPA ${dec2(cgpa.mean)}`} sql={cgpa.sql}
          table={{ columns: ["Degree class", "CGPA range", "Students", "Average CGPA"], align: ["l", "l", "r", "r"],
            rows: cgpa.rows.map((r, i) => [r.cls, DEGREE_CLASSES[i].range, num(r.students), r.avg_cgpa == null ? "—" : dec2(r.avg_cgpa)]) }}
          footnote="First 4.50-5.00, 2:1 3.50-4.49, 2:2 2.40-3.49, Third 1.50-2.39, Pass 1.00-1.49">
          <Columns data={cgpa.rows.map((r) => ({ label: r.cls, students: r.students }))} series={[{ key: "students", name: "Students", color: COLORS.series1 }]} />
        </ChartCard>
        <RingCard title="Pass rate" pct={passRate} centerLabel="Courses passed"
          left={{ label: "Passed", value: num(k.passed) }} right={{ label: "Failed", value: num(k.results - k.passed) }}
          note={`Score of 40 or more. ${label}`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={`Pass rate by ${unitName}`} subtitle={`Share of course results at 40 or above, ${label}. Lowest first`} sql={byUnit.sql}
          table={{ columns: [unitName === "faculty" ? "Faculty" : "Department", "Pass rate", "GPA", "Results"], align: ["l", "r", "r", "r"],
            rows: byUnit.rows.map((r) => [r.label, pct(r.pass_rate), dec2(r.gpa), num(r.results)]) }}>
          <HBars data={byUnit.rows.map((r) => ({ label: f.faculty ? r.label : shortFaculty(r.label), pass_rate: r.pass_rate }))}
            series={[{ key: "pass_rate", name: "Pass rate", color: COLORS.series1 }]} format="pct" labelWidth={f.faculty ? 170 : 128} />
        </ChartCard>
        <ChartCard title="Grade distribution" subtitle={`All course results, ${label}`} sql={grades.sql}
          table={{ columns: ["Grade", "Results"], align: ["l", "r"], rows: grades.rows.map((r) => [r.grade, num(r.results)]) }}
          footnote="A 70-100, B 60-69, C 50-59, D 45-49, E 40-44, F 0-39 (five-point scale)">
          <Columns data={grades.rows.map((r) => ({ label: r.grade, results: r.results }))} series={[{ key: "results", name: "Results", color: COLORS.series1 }]} />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="Courses with the lowest pass rates" subtitle={`${label}. Courses with ${f.faculty ? "25" : "60"} or more results`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-2 pr-3 font-medium">Course</th>
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 text-right font-medium">Results</th>
                  <th className="py-2 pr-3 text-right font-medium">Average score</th>
                  <th className="py-2 text-right font-medium">Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {hardest.rows.map((r) => (
                  <tr key={r.course_code} className="border-b border-line/70 last:border-0">
                    <td className="py-2.5 pr-3 font-mono text-[12.5px] text-ink">{r.course_code}</td>
                    <td className="py-2.5 pr-3 text-ink">{r.course_title}</td>
                    <td className="tnum py-2.5 pr-3 text-right text-ink-2">{num(r.results)}</td>
                    <td className="tnum py-2.5 pr-3 text-right text-ink-2">{dec1(r.avg_score)}</td>
                    <td className="tnum py-2.5 text-right font-medium text-accent-ink">{pct(r.pass_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <ChartCard title="Pass rate by session" subtitle={`Share of results passed, ${f.faculty ? f.faculty.short : "all faculties"}`} sql={bySession.sql}
          table={{ columns: ["Session", "Pass rate", "GPA", "Results"], align: ["l", "r", "r", "r"], rows: bySession.rows.map((r) => [r.session_name, pct(r.pass_rate), dec2(r.gpa), num(r.results)]) }}>
          <TrendLine data={bySession.rows.map((r) => ({ label: r.session_name, pass_rate: r.pass_rate }))}
            series={{ key: "pass_rate", name: "Pass rate", color: COLORS.series1 }} format="pct" />
        </ChartCard>
      </div>
    </DashboardFrame>
  );
}
