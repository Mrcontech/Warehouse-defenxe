import "server-only";
import { q } from "@/lib/sql";
import { factWhere, type Filters } from "@/lib/filters";

export const DEGREE_CLASSES = [
  { key: "First", label: "First", range: "4.50-5.00" },
  { key: "2:1", label: "2:1", range: "3.50-4.49" },
  { key: "2:2", label: "2:2", range: "2.40-3.49" },
  { key: "Third", label: "Third", range: "1.50-2.39" },
  { key: "Pass", label: "Pass", range: "1.00-1.49" },
  { key: "Below 1.00", label: "Below 1.00", range: "0.00-0.99" },
] as const;

export async function academicKpis(f: Filters) {
  const w = factWhere(f, "r");
  const sql = `
    SELECT SUM(r.quality_points) / SUM(r.credit_units) AS gpa,
           COUNT(*)                                    AS results,
           COUNT(DISTINCT r.student_key)               AS students,
           AVG(r.total_score)                          AS avg_score,
           SUM(r.is_pass)                              AS passed
    FROM fact_result r
    WHERE 1 = 1${w.sql}`;
  type K = { gpa: number; results: number; students: number; avg_score: number; passed: number };
  const current = await q<K>(sql, w.params);
  let previous: K | null = null;
  if (f.previous) {
    const pw = factWhere({ session: f.previous, faculty: f.faculty }, "r");
    previous = (await q<K>(sql, pw.params)).rows[0] ?? null;
  }
  return { ...current, previous };
}

/**
 * Students by degree class of their cumulative CGPA. For a session: the students enrolled in it,
 * with CGPA over every result up to and including that session. CGPA is always
 * sum(quality points) / sum(credit units), never an average of GPAs.
 */
export async function cgpaDistribution(f: Filters) {
  const enrolled = factWhere(f, "e");
  const params: unknown[] = [...enrolled.params];
  let upTo = "";
  if (f.session) {
    upTo = " AND ds.start_year <= ?";
    params.push(f.session.startYear);
  }
  const res = await q<{ cls: string; students: number; avg_cgpa: number }>(
    `
    SELECT CASE WHEN c.cgpa >= 4.5 THEN 'First'
                WHEN c.cgpa >= 3.5 THEN '2:1'
                WHEN c.cgpa >= 2.4 THEN '2:2'
                WHEN c.cgpa >= 1.5 THEN 'Third'
                WHEN c.cgpa >= 1.0 THEN 'Pass'
                ELSE 'Below 1.00' END AS cls,
           COUNT(*) AS students, ROUND(AVG(c.cgpa), 2) AS avg_cgpa
    FROM (
      SELECT r.student_key, SUM(r.quality_points) / SUM(r.credit_units) AS cgpa
      FROM fact_result r
      JOIN dim_session ds ON ds.session_key = r.session_key
      WHERE r.student_key IN (SELECT e.student_key FROM fact_enrolment e WHERE 1 = 1${enrolled.sql})${upTo}
      GROUP BY r.student_key
    ) c
    GROUP BY cls`,
    params,
  );
  const by = new Map(res.rows.map((r) => [r.cls, r]));
  const rows = DEGREE_CLASSES.map((d) => ({ cls: d.label, students: by.get(d.key)?.students ?? 0, avg_cgpa: by.get(d.key)?.avg_cgpa ?? null }));
  const total = rows.reduce((a, r) => a + r.students, 0);
  const mean = total ? res.rows.reduce((a, r) => a + r.students * (r.avg_cgpa ?? 0), 0) / total : null;
  return { rows, sql: res.sql, total, mean };
}

/** Pass rate by faculty, or by department when a faculty is selected. Lowest first. */
export async function passRateByUnit(f: Filters) {
  const w = factWhere(f, "r");
  const [key, label, code, table] = f.faculty
    ? ["d.department_key", "d.department_name", "d.department_code", "dim_department d ON d.department_key = r.department_key"]
    : ["fa.faculty_key", "fa.faculty_name", "fa.faculty_code", "dim_faculty fa ON fa.faculty_key = r.faculty_key"];
  return q<{ label: string; code: string; pass_rate: number; gpa: number; results: number }>(
    `
    SELECT ${label} AS label, ${code} AS code,
           ROUND(100 * AVG(r.is_pass), 1)                   AS pass_rate,
           ROUND(SUM(r.quality_points) / SUM(r.credit_units), 2) AS gpa,
           COUNT(*)                                          AS results
    FROM fact_result r
    JOIN ${table}
    WHERE 1 = 1${w.sql}
    GROUP BY ${key}, ${label}, ${code}
    ORDER BY pass_rate`,
    w.params,
  );
}

export async function gradeDistribution(f: Filters) {
  const w = factWhere(f, "r");
  return q<{ grade: string; results: number }>(
    `
    SELECT r.grade, COUNT(*) AS results
    FROM fact_result r
    WHERE 1 = 1${w.sql}
    GROUP BY r.grade
    ORDER BY r.grade`,
    w.params,
  );
}

/** Courses with the lowest pass rates (enough results to be meaningful). */
export async function hardestCourses(f: Filters) {
  const w = factWhere(f, "r");
  const minResults = f.faculty ? 25 : 60;
  return q<{ course_code: string; course_title: string; results: number; pass_rate: number; avg_score: number }>(
    `
    SELECT c.course_code, c.course_title, COUNT(*) AS results,
           ROUND(100 * AVG(r.is_pass), 1) AS pass_rate,
           ROUND(AVG(r.total_score), 1)   AS avg_score
    FROM fact_result r
    JOIN dim_course c ON c.course_key = r.course_key
    WHERE 1 = 1${w.sql}
    GROUP BY c.course_key, c.course_code, c.course_title
    HAVING COUNT(*) >= ${minResults}
    ORDER BY pass_rate, results DESC
    LIMIT 8`,
    w.params,
  );
}

export async function passRateBySession(f: Filters) {
  const w = factWhere(f, "r", { session: false });
  return q<{ session_name: string; pass_rate: number; gpa: number; results: number }>(
    `
    SELECT ds.session_name,
           ROUND(100 * AVG(r.is_pass), 1)                        AS pass_rate,
           ROUND(SUM(r.quality_points) / SUM(r.credit_units), 2) AS gpa,
           COUNT(*)                                               AS results
    FROM fact_result r
    JOIN dim_session ds ON ds.session_key = r.session_key
    WHERE 1 = 1${w.sql}
    GROUP BY ds.session_key, ds.session_name
    ORDER BY ds.session_key`,
    w.params,
  );
}
