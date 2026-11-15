import "server-only";
import { q } from "@/lib/sql";
import { factWhere, type Filters } from "@/lib/filters";

export async function enrolmentKpis(f: Filters) {
  const w = factWhere(f, "e");
  const sql = `
    SELECT COUNT(DISTINCT e.student_key)                                    AS students,
           SUM(e.is_new_entrant)                                            AS new_intake,
           COUNT(DISTINCT CASE WHEN s.gender = 'Female' THEN e.student_key END) AS female,
           COUNT(DISTINCT CASE WHEN s.gender = 'Male' THEN e.student_key END)   AS male,
           COUNT(DISTINCT e.department_key)                                 AS departments,
           SUM(e.level = d.programme_years * 100)                           AS final_year
    FROM fact_enrolment e
    JOIN dim_student s    ON s.student_key    = e.student_key
    JOIN dim_department d ON d.department_key = e.department_key
    WHERE 1 = 1${w.sql}`;
  type K = { students: number; new_intake: number; female: number; male: number; departments: number; final_year: number };
  const current = await q<K>(sql, w.params);
  let previous: K | null = null;
  if (f.previous) {
    const pw = factWhere({ session: f.previous, faculty: f.faculty }, "e");
    previous = (await q<K>(sql, pw.params)).rows[0] ?? null;
  }
  return { ...current, previous };
}

export async function enrolmentBySession(f: Filters) {
  const w = factWhere(f, "e", { session: false });
  return q<{ session_name: string; male: number; female: number; total: number }>(
    `
    SELECT ds.session_name,
           SUM(s.gender = 'Male')   AS male,
           SUM(s.gender = 'Female') AS female,
           COUNT(*)                 AS total
    FROM fact_enrolment e
    JOIN dim_session ds ON ds.session_key = e.session_key
    JOIN dim_student s  ON s.student_key  = e.student_key
    WHERE 1 = 1${w.sql}
    GROUP BY ds.session_key, ds.session_name
    ORDER BY ds.session_key`,
    w.params,
  );
}

/** By faculty when no faculty is selected, otherwise by department within it. */
export async function enrolmentByUnit(f: Filters) {
  const w = factWhere(f, "e");
  if (f.faculty) {
    return q<{ label: string; code: string; students: number }>(
      `
      SELECT d.department_name AS label, d.department_code AS code, COUNT(*) AS students
      FROM fact_enrolment e
      JOIN dim_department d ON d.department_key = e.department_key
      WHERE 1 = 1${w.sql}
      GROUP BY d.department_key, d.department_name, d.department_code
      ORDER BY students DESC`,
      w.params,
    );
  }
  return q<{ label: string; code: string; students: number }>(
    `
    SELECT fa.faculty_name AS label, fa.faculty_code AS code, COUNT(*) AS students
    FROM fact_enrolment e
    JOIN dim_faculty fa ON fa.faculty_key = e.faculty_key
    WHERE 1 = 1${w.sql}
    GROUP BY fa.faculty_key, fa.faculty_name, fa.faculty_code
    ORDER BY students DESC`,
    w.params,
  );
}

export async function enrolmentByLevel(f: Filters) {
  const w = factWhere(f, "e");
  return q<{ level: number; male: number; female: number; total: number }>(
    `
    SELECT e.level,
           SUM(s.gender = 'Male')   AS male,
           SUM(s.gender = 'Female') AS female,
           COUNT(*)                 AS total
    FROM fact_enrolment e
    JOIN dim_student s ON s.student_key = e.student_key
    WHERE 1 = 1${w.sql}
    GROUP BY e.level
    ORDER BY e.level`,
    w.params,
  );
}

export async function enrolmentByState(f: Filters) {
  const w = factWhere(f, "e");
  return q<{ state: string; students: number }>(
    `
    SELECT s.state_of_origin AS state, COUNT(*) AS students
    FROM fact_enrolment e
    JOIN dim_student s ON s.student_key = e.student_key
    WHERE 1 = 1${w.sql}
    GROUP BY s.state_of_origin
    ORDER BY students DESC
    LIMIT 8`,
    w.params,
  );
}

export async function programmes(f: Filters) {
  const w = factWhere(f, "e");
  return q<{ department: string; faculty: string; degree: string; students: number; new_intake: number; female_pct: number }>(
    `
    SELECT d.department_name AS department, d.faculty_name AS faculty, d.degree_awarded AS degree,
           COUNT(*) AS students, SUM(e.is_new_entrant) AS new_intake,
           ROUND(100 * AVG(s.gender = 'Female'), 1) AS female_pct
    FROM fact_enrolment e
    JOIN dim_department d ON d.department_key = e.department_key
    JOIN dim_student s    ON s.student_key    = e.student_key
    WHERE 1 = 1${w.sql}
    GROUP BY d.department_key, d.department_name, d.faculty_name, d.degree_awarded
    ORDER BY students DESC
    LIMIT 10`,
    w.params,
  );
}
