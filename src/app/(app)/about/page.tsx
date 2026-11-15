import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon, ArrowsClockwiseIcon, ChartBarIcon, DatabaseIcon, ExamIcon, FunnelIcon, GaugeIcon, IdentificationCardIcon,
  KeyIcon, LightningIcon, LinkIcon, MoneyIcon, ShieldCheckIcon, UsersIcon,
} from "@phosphor-icons/react/ssr";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { SimulatedPill } from "@/components/ui/SimulatedPill";
import { formatMs, num } from "@/lib/format";
import { warehouseFacts } from "@/lib/queries/about";

export const metadata: Metadata = { title: "How It Works" };

async function factsOrNull() {
  try {
    return await warehouseFacts();
  } catch {
    return null; // MySQL down or warehouse empty: the page still explains everything, without live numbers
  }
}

function Step({ icon: Icon, title, text, accent = false }: { icon: typeof DatabaseIcon; title: string; text: string; accent?: boolean }) {
  return (
    <div className={`rounded-[14px] border p-4 ${accent ? "border-accent-tint bg-accent-soft" : "border-line bg-surface"}`}>
      <span className={`grid size-9 place-items-center rounded-[10px] ${accent ? "bg-accent text-[#fff7f5]" : "bg-surface-2 text-ink"}`}>
        <Icon size={19} weight="bold" />
      </span>
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{text}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="grid place-items-center text-faint" aria-hidden>
      <ArrowRightIcon size={20} className="rotate-90 lg:rotate-0" />
    </div>
  );
}

const SECTIONS = [
  { id: "architecture", label: "Architecture" },
  { id: "database-or-warehouse", label: "Database or data warehouse?" },
  { id: "star-schema", label: "Star schema" },
  { id: "etl", label: "ETL" },
  { id: "excel", label: "Why not Excel?" },
  { id: "data", label: "About the data" },
];

export default async function AboutPage() {
  const facts = await factsOrNull();
  const c = facts?.counts;
  const run = facts?.run;
  const loaded = c ? c.results + c.enrolments + c.fees : null;

  return (
    <>
      <PageHeader title="How It Works" crumbs={[{ label: "Warehouse" }, { label: "How It Works" }]} right={<SimulatedPill />} />
      <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="press rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-2 hover:border-line-strong hover:text-ink">
            {s.label}
          </a>
        ))}
      </nav>

      <div className="mt-5 grid grid-cols-1 gap-4">
        <Card id="architecture" title="Architecture" subtitle="From three office systems to one dashboard. Everything runs on one laptop, offline.">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.25fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,0.9fr)] lg:items-center">
            <div className="grid grid-cols-1 gap-2">
              {[
                { icon: IdentificationCardIcon, t: "Admissions & Records", f: "admissions.csv" },
                { icon: MoneyIcon, t: "Bursary", f: "bursary.csv" },
                { icon: ExamIcon, t: "Examinations & Records", f: "exams.csv" },
              ].map((s) => (
                <div key={s.t} className="flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-surface-2 text-ink">
                    <s.icon size={17} weight="bold" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink">{s.t}</span>
                    <span className="block font-mono text-[12px] text-muted">{s.f}</span>
                  </span>
                </div>
              ))}
              <p className="px-1 text-[12px] text-muted">Three separate source systems (simulated as CSV exports)</p>
            </div>
            <Arrow />
            <Step icon={FunnelIcon} title="ETL" text="Python and pandas: extract the files, clean and check every row, load the warehouse." accent />
            <Arrow />
            <Step icon={DatabaseIcon} title="Data warehouse" text="MySQL database ebsu_dw: a star schema of 3 fact tables and 5 dimensions." />
            <Arrow />
            <Step icon={ChartBarIcon} title="Dashboard" text="Next.js and Recharts: Overview, Finance and Academics, filtered by session and faculty." />
            <Arrow />
            <Step icon={UsersIcon} title="Decision makers" text="Vice-Chancellor, Bursar, Deans and Heads of Department." />
          </div>
        </Card>

        <Card id="database-or-warehouse" title="Database or data warehouse?"
          subtitle="Both store data in tables. They are built for different jobs, so a university needs both.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="w-[16%] py-2.5 pr-4 font-medium text-muted"></th>
                  <th className="py-2.5 pr-4 font-semibold text-ink">Operational database</th>
                  <th className="py-2.5 font-semibold text-ink">Data warehouse</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {[
                  ["Job", "Runs the daily work of one office: admit a student, record a payment, enter a score.", "Answers management questions across offices and years."],
                  ["Typical question", "Has this student paid this session's fees?", "How much did each faculty collect in each session, and how much is still owed?"],
                  ["Data", "Current state of one system.", "History of four sessions, integrated from three systems."],
                  ["Design", "Normalised tables, tuned for many small writes (OLTP).", "Star schema of facts and dimensions, tuned for reading and summarising (OLAP)."],
                  ["Updated", "All day, by staff, one record at a time.", "In batches by the ETL. Here, whenever an administrator presses Run ETL."],
                  ["In this project", "admissions.csv, bursary.csv and exams.csv stand in for these systems.", "The ebsu_dw database in MySQL, filled by warehouse/etl/etl.py."],
                ].map(([k, a, b]) => (
                  <tr key={k} className="border-b border-line/70 last:border-0">
                    <th scope="row" className="py-3 pr-4 text-left font-medium text-muted">{k}</th>
                    <td className="py-3 pr-4 text-ink-2">{a}</td>
                    <td className="py-3 text-ink">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card id="star-schema" title="Star schema: facts and dimensions"
            action={<Link href="/schema" className="press shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium text-ink hover:border-line-strong">Open the schema</Link>}>
            <p className="text-[14px] leading-relaxed text-ink-2">
              A <strong className="font-semibold text-ink">fact table</strong> records events and the numbers measured about them: a registration, an
              invoice line, a course result. A <strong className="font-semibold text-ink">dimension table</strong> describes the who, what and when
              that you filter and group by: the student, the course, the department, the faculty, the session. Each fact row points to its
              dimensions through foreign keys, so the diagram looks like a star.
            </p>
            <div className="mt-4 rounded-[14px] border border-line bg-surface-2 p-4">
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted">One question, taken apart</p>
              <p className="mt-2 text-[14.5px] font-medium text-ink">&ldquo;What was the pass rate in each faculty in 2023/2024?&rdquo;</p>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-[13px]">
                <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Measure</dt><dd className="font-mono text-[12.5px] text-ink">AVG(fact_result.is_pass)</dd></div>
                <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Group by</dt><dd className="font-mono text-[12.5px] text-ink">dim_faculty.faculty_name</dd></div>
                <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Filter</dt><dd className="font-mono text-[12.5px] text-ink">dim_session.session_name = &apos;2023/2024&apos;</dd></div>
              </dl>
            </div>
            <p className="mt-4 text-[13px] text-muted">
              {c ? `${num(loaded)} fact rows and ${num(c.students)} students, ${num(c.courses)} courses, ${num(c.departments)} departments, ${num(c.faculties)} faculties and ${num(c.sessions)} sessions in the dimensions.` : "Live counts appear here once the warehouse is loaded."}
            </p>
          </Card>

          <Card id="etl" title="ETL: where the data comes from"
            action={<Link href="/etl" className="press shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium text-ink hover:border-line-strong">Open the ETL</Link>}>
            <ol className="grid grid-cols-1 gap-3">
              {[
                { t: "Extract", d: `Read the three exports and the official department list${run ? `: ${num(run.extracted)} rows` : ""}.` },
                { t: "Transform", d: `Apply 20 cleaning rules (matric numbers, sessions, dates, gender, naira amounts, course codes, department names), remove duplicates${run ? ` (${num(run.duplicates)})` : ""} and reject rows that cannot be trusted${run ? ` (${num(run.rejected)}), each with its reason` : ", each with its reason"}.` },
                { t: "Load", d: "Fill shadow copies of the eight tables, check row counts and all 13 foreign keys, then swap them in with one atomic RENAME TABLE. A failed run leaves the live data untouched." },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-night text-[12.5px] font-semibold text-[#fff8f5]">{i + 1}</span>
                  <p className="text-[14px] leading-relaxed text-ink-2"><span className="font-semibold text-ink">{s.t}.</span> {s.d}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[13px] text-muted">
              {run ? `Last run: #${run.run_id}, ${formatMs(run.duration_ms)}. Every run is logged in etl_run, with its rules and rejected rows.` : "Every run is logged in etl_run, with its rules and rejected rows."}
            </p>
          </Card>
        </div>

        <section id="excel" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card title="Why not just use Excel?" subtitle="Excel is good for one person looking at one file. This problem is three offices, four sessions and many readers.">
            <ul className="grid grid-cols-1 gap-4">
              {[
                { icon: LinkIcon, t: "Three systems, matched the same way every time", d: "In Excel someone copies three exports into one workbook and matches matric numbers by hand. The ETL does it in seconds and records what it changed and what it refused." },
                { icon: ArrowsClockwiseIcon, t: "Rules written once, tested and repeatable", d: "The 20 cleaning rules are code with 15 automated tests. Next session, press Run ETL again; nobody has to remember the steps." },
                { icon: ShieldCheckIcon, t: "The database refuses bad data", d: "13 foreign keys and unique keys stop a result for a student who does not exist, or a payment counted twice. A spreadsheet cell accepts anything typed into it." },
                { icon: KeyIcon, t: "One version of the truth, behind a login", d: "Every office reads the same warehouse, so the Bursar and the Registrar quote the same figures. Copies of a workbook passed around by email drift apart." },
                { icon: GaugeIcon, t: "Room to grow", d: `${c ? `${num(c.results)} result rows` : "The result rows"} cover four sessions of a simulated university. Excel stops at 1,048,576 rows per sheet and slows down long before that; MySQL indexes keep the dashboard fast.` },
              ].map((r) => (
                <li key={r.t} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink"><r.icon size={18} weight="bold" /></span>
                  <span>
                    <span className="block text-[14.5px] font-semibold text-ink">{r.t}</span>
                    <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-2">{r.d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <section className="card-night flex flex-col p-5 sm:p-6" aria-labelledby="bench-title">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-[10px] bg-night-2 text-series-2-dark">
                <LightningIcon size={19} weight="fill" />
              </span>
              <h2 id="bench-title" className="text-[17px] font-semibold tracking-tight text-[#fff8f5]">Live benchmark</h2>
            </div>
            {facts ? (
              <>
                <p className="mt-5 text-[13.5px] text-night-muted">This query ran against the warehouse while the page loaded:</p>
                <p className="tnum mt-1 text-[52px] font-semibold leading-none tracking-tight text-[#fff8f5]">
                  {facts.benchMs < 10 ? facts.benchMs.toFixed(1) : Math.round(facts.benchMs)} ms
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-[#ece6df]">
                  It joined {num(c!.results)} result rows to four dimensions and grouped them into {num(facts.benchGroups)} groups (session × faculty × gender × course type),
                  with pass rate and GPA for each. Refresh the page to run it again.
                </p>
                <pre className="mt-4 max-h-[300px] flex-1 overflow-auto whitespace-pre rounded-[12px] bg-night-2 p-4 font-mono text-[11.5px] leading-relaxed text-[#ece6df]">{facts.benchSql}</pre>
              </>
            ) : (
              <p className="mt-5 text-[14px] text-night-muted">Start MySQL and load the warehouse to run the benchmark here.</p>
            )}
          </section>
        </section>

        <Card id="data" title="About the data" subtitle="All student, fee and result data in this project is simulated. No real student or staff record is used anywhere.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                t: "Real (EBSU's published values)", cls: "border-line bg-surface-2",
                items: [
                  "Names of the 9 faculties and the programmes they admit",
                  "Acceptance fees: ₦50,050 for Medicine, Law, Nursing and Medical Laboratory Science; ₦30,050 for others",
                  "The five-point grading scale (A = 70 and above … F below 40)",
                  "School fees payable in two instalments from 2023/2024, and the 10% tuition cut announced in April 2024",
                ],
              },
              {
                t: "Simulated (generated)", cls: "border-accent-tint bg-accent-soft",
                items: [
                  "Every student: names drawn at random from Nigerian name lists, so no combination describes a real person",
                  "Matric numbers, which all contain SIM (for example EBSU/SIM/2021/0085400)",
                  "Enrolment numbers, course titles, scores, invoices and payments",
                  "Tuition amounts by fee band (EBSU does not publish them for every programme)",
                ],
              },
              {
                t: "Made messy on purpose", cls: "border-line bg-surface",
                items: [
                  "Matric numbers in lower case, with dashes or extra spaces; session labels like 2021-2022 or 2021/22",
                  "Gender as M, male or f; dates as dd/mm/yyyy; department names spelt differently; faculties in capitals",
                  "Amounts written as ₦1,250,000.00; course codes like csc301; semesters as 1st and 2nd",
                  "Re-exported duplicates, and a few rows the ETL must reject: missing matric numbers, unknown students, impossible scores or levels",
                ],
              },
            ].map((col) => (
              <div key={col.t} className={`rounded-[14px] border p-4 ${col.cls}`}>
                <h3 className="text-[15px] font-semibold text-ink">{col.t}</h3>
                <ul className="mt-3 grid grid-cols-1 gap-2.5">
                  {col.items.map((i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-ink-2">
                      <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink-2" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-muted">
            The generator is <span className="font-mono">warehouse/generator/generate_data.py</span>. It uses a fixed random seed, so it produces the same files every time.
          </p>
        </Card>
      </div>
    </>
  );
}
