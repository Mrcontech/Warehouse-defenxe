import "server-only";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import path from "node:path";
import { query } from "@/lib/db";

export type RunRow = {
  run_id: number; started_at: string; finished_at: string | null; status: string;
  duration_ms: number | null; triggered_by: string; message: string | null; loaded: number | null;
};
export type SourceRow = {
  source_name: string; file_name: string; rows_extracted: number; rows_duplicate: number;
  rows_rejected: number; rows_loaded: number; rows_cleaned: number;
};

const TABLE_ORDER = ["dim_faculty", "dim_department", "dim_session", "dim_student", "dim_course", "fact_enrolment", "fact_fee_payment", "fact_result"];

/** Everything the ETL Pipeline page shows about past runs. */
export async function etlOverview() {
  const runs = await query<RunRow>(
    `SELECT r.run_id, r.started_at, r.finished_at, r.status, r.duration_ms, r.triggered_by, r.message,
            (SELECT SUM(s.rows_loaded) FROM etl_run_source s WHERE s.run_id = r.run_id) AS loaded
     FROM etl_run r ORDER BY r.run_id DESC LIMIT 10`,
  );
  const last = runs.find((r) => r.status === "success") ?? null;
  if (!last) return { runs, last, sources: [], tables: [], rejects: [], rules: [] };
  const [sources, tables, rejects, rules] = await Promise.all([
    query<SourceRow>(
      "SELECT * FROM etl_run_source WHERE run_id = ? ORDER BY FIELD(source_name, 'admissions', 'bursary', 'exams')",
      [last.run_id],
    ),
    query<{ table_name: string; rows_loaded: number }>("SELECT table_name, rows_loaded FROM etl_run_table WHERE run_id = ?", [last.run_id]),
    query<{ source_name: string; reason: string; n: number; example: string }>(
      `SELECT source_name, reason, COUNT(*) AS n, MIN(raw_record) AS example
       FROM etl_reject WHERE run_id = ?
       GROUP BY source_name, reason
       ORDER BY FIELD(source_name, 'admissions', 'bursary', 'exams'), n DESC`,
      [last.run_id],
    ),
    query<{ source_name: string; rule_text: string; rows_affected: number }>(
      "SELECT source_name, rule_text, rows_affected FROM etl_run_rule WHERE run_id = ? ORDER BY seq",
      [last.run_id],
    ),
  ]);
  tables.sort((a, b) => TABLE_ORDER.indexOf(a.table_name) - TABLE_ORDER.indexOf(b.table_name));
  return { runs, last, sources, tables, rejects, rules };
}

// ---------------------------------------------------------------- source previews
const SOURCES = [
  { source: "admissions", file: "admissions.csv", system: "Admissions & Records" },
  { source: "bursary", file: "bursary.csv", system: "Bursary (fees)" },
  { source: "exams", file: "exams.csv", system: "Examinations & Records" },
];

const CANON = {
  matric: /^EBSU\/SIM\/\d{4}\/\d{7}$/,
  session: /^\d{4}\/\d{4}$/,
  iso: /^\d{4}-\d{2}-\d{2}$/,
  amount: /^\d+\.\d{2}$/,
  course: /^[A-Z]{3} \d{3}$/,
};

/** Which cells a reader would call messy: the ETL fixes or rejects each of these. */
function isMessy(col: string, v: string): boolean {
  if (["matric_no", "matric_number"].includes(col)) return !CANON.matric.test(v);
  if (["session", "academic_session", "year_of_admission"].includes(col)) return !CANON.session.test(v);
  if (col === "date_of_birth") return !CANON.iso.test(v);
  if (col === "payment_date") return v !== "" && !CANON.iso.test(v);
  if (col === "sex") return v !== "M" && v !== "F";
  if (col === "amount_due" || col === "amount_paid") return !CANON.amount.test(v);
  if (col === "course_code") return !CANON.course.test(v);
  if (col === "semester") return v !== "First" && v !== "Second";
  if (col === "faculty") return v === v.toUpperCase() && v.length > 3;
  if (col === "ca_score") return v === "" || Number(v) > 30;
  if (col === "exam_score") return v === "" || Number(v) > 70;
  if (col === "level") return !/^[1-6]00$/.test(v);
  return false;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function headOfFile(file: string, bytes = 600_000): string[] {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    const lines = buf.subarray(0, n).toString("utf8").split(/\r?\n/);
    return n === bytes ? lines.slice(0, -1) : lines.filter((l) => l.length > 0);
  } finally {
    closeSync(fd);
  }
}

export type PreviewCell = { v: string; messy: boolean };
export type SourcePreviewData = { source: string; file: string; system: string; columns: string[]; bytes: number; rows: PreviewCell[][] };

/** Three clean and three messy rows from each export, as they arrive from the source systems. */
export function sourcePreviews(): SourcePreviewData[] {
  const dir = path.join(process.cwd(), "warehouse", "data", "sources");
  const out: SourcePreviewData[] = [];
  for (const s of SOURCES) {
    const file = path.join(dir, s.file);
    try {
      const lines = headOfFile(file);
      const columns = parseCsvLine(lines[0]);
      const clean: PreviewCell[][] = [], messy: PreviewCell[][] = [];
      for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line).map((v, i) => ({ v, messy: isMessy(columns[i], v) }));
        if (cells.some((c) => c.messy)) { if (messy.length < 3) messy.push(cells); }
        else if (clean.length < 3) clean.push(cells);
        if (clean.length >= 3 && messy.length >= 3) break;
      }
      out.push({ ...s, columns, bytes: statSync(file).size, rows: [...clean, ...messy] });
    } catch {
      out.push({ ...s, columns: [], bytes: 0, rows: [] });
    }
  }
  return out;
}
