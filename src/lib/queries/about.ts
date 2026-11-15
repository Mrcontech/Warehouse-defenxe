import "server-only";
import { query, timedQuery } from "@/lib/db";
import { displaySql } from "@/lib/sql";

export const BENCHMARK_SQL = `
SELECT ds.session_name, fa.faculty_code, st.gender, c.course_category,
       COUNT(*)                                    AS results,
       AVG(r.is_pass) * 100                        AS pass_rate,
       SUM(r.quality_points) / SUM(r.credit_units) AS gpa
FROM fact_result r
JOIN dim_session ds ON ds.session_key = r.session_key
JOIN dim_faculty fa ON fa.faculty_key = r.faculty_key
JOIN dim_student st ON st.student_key = r.student_key
JOIN dim_course  c  ON c.course_key   = r.course_key
GROUP BY ds.session_name, fa.faculty_code, st.gender, c.course_category`;

/** Live numbers for the "why not Excel" section. */
export async function warehouseFacts() {
  const [counts] = await query<{
    results: number;
    enrolments: number;
    fees: number;
    students: number;
    courses: number;
    departments: number;
    faculties: number;
    sessions: number;
  }>(
    `SELECT (SELECT COUNT(*) FROM fact_result) AS results,
            (SELECT COUNT(*) FROM fact_enrolment) AS enrolments,
            (SELECT COUNT(*) FROM fact_fee_payment) AS fees,
            (SELECT COUNT(*) FROM dim_student) AS students,
            (SELECT COUNT(*) FROM dim_course) AS courses,
            (SELECT COUNT(*) FROM dim_department) AS departments,
            (SELECT COUNT(*) FROM dim_faculty) AS faculties,
            (SELECT COUNT(*) FROM dim_session) AS sessions`,
  );
  const [run] = await query<{ extracted: number; rejected: number; duplicates: number; run_id: number; duration_ms: number }>(
    `SELECT r.run_id, r.duration_ms, SUM(s.rows_extracted) AS extracted, SUM(s.rows_rejected) AS rejected,
            SUM(s.rows_duplicate) AS duplicates
     FROM etl_run r JOIN etl_run_source s ON s.run_id = r.run_id
     WHERE r.run_id = (SELECT MAX(run_id) FROM etl_run WHERE status = 'success')
     GROUP BY r.run_id, r.duration_ms`,
  );
  const bench = await timedQuery(BENCHMARK_SQL);
  return { counts, run: run ?? null, benchMs: bench.ms, benchGroups: bench.rows.length, benchSql: displaySql(BENCHMARK_SQL, []) };
}
