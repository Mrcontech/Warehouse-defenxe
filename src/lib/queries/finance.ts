import "server-only";
import { q } from "@/lib/sql";
import { factWhere, type Filters } from "@/lib/filters";

export type Money = { billed: number; paid: number; outstanding: number };

export async function financeKpis(f: Filters) {
  const w = factWhere(f, "p");
  const sql = `
    SELECT SUM(p.amount_billed)      AS billed,
           SUM(p.amount_paid)        AS paid,
           SUM(p.amount_outstanding) AS outstanding,
           COUNT(DISTINCT p.student_key) AS students,
           COUNT(DISTINCT CASE WHEN p.amount_outstanding > 0 THEN p.student_key END) AS debtors
    FROM fact_fee_payment p
    WHERE 1 = 1${w.sql}`;
  const current = await q<Money & { students: number; debtors: number }>(sql, w.params);
  let previous: (Money & { students: number; debtors: number }) | null = null;
  if (f.previous) {
    const pw = factWhere({ session: f.previous, faculty: f.faculty }, "p");
    previous = (await q<Money & { students: number; debtors: number }>(sql, pw.params)).rows[0] ?? null;
  }
  return { ...current, previous };
}

/** By faculty when no faculty is selected, otherwise by department within it. */
export async function feesByUnit(f: Filters) {
  const w = factWhere(f, "p");
  if (f.faculty) {
    return q<Money & { label: string; code: string }>(
      `
      SELECT d.department_name AS label, d.department_code AS code,
             SUM(p.amount_billed) AS billed, SUM(p.amount_paid) AS paid,
             SUM(p.amount_outstanding) AS outstanding
      FROM fact_fee_payment p
      JOIN dim_department d ON d.department_key = p.department_key
      WHERE 1 = 1${w.sql}
      GROUP BY d.department_key, d.department_name, d.department_code
      ORDER BY outstanding DESC`,
      w.params,
    );
  }
  return q<Money & { label: string; code: string }>(
    `
    SELECT fa.faculty_name AS label, fa.faculty_code AS code,
           SUM(p.amount_billed) AS billed, SUM(p.amount_paid) AS paid,
           SUM(p.amount_outstanding) AS outstanding
    FROM fact_fee_payment p
    JOIN dim_faculty fa ON fa.faculty_key = p.faculty_key
    WHERE 1 = 1${w.sql}
    GROUP BY fa.faculty_key, fa.faculty_name, fa.faculty_code
    ORDER BY outstanding DESC`,
    w.params,
  );
}

export async function feesBySession(f: Filters) {
  const w = factWhere(f, "p", { session: false });
  return q<Money & { session_name: string }>(
    `
    SELECT ds.session_name,
           SUM(p.amount_billed) AS billed, SUM(p.amount_paid) AS paid,
           SUM(p.amount_outstanding) AS outstanding
    FROM fact_fee_payment p
    JOIN dim_session ds ON ds.session_key = p.session_key
    WHERE 1 = 1${w.sql}
    GROUP BY ds.session_key, ds.session_name
    ORDER BY ds.session_key`,
    w.params,
  );
}

export async function feesByItem(f: Filters) {
  const w = factWhere(f, "p");
  return q<Money & { fee_item: string; invoices: number }>(
    `
    SELECT p.fee_item, COUNT(*) AS invoices,
           SUM(p.amount_billed) AS billed, SUM(p.amount_paid) AS paid,
           SUM(p.amount_outstanding) AS outstanding
    FROM fact_fee_payment p
    WHERE 1 = 1${w.sql}
    GROUP BY p.fee_item
    ORDER BY billed DESC`,
    w.params,
  );
}

export async function paymentStatus(f: Filters) {
  const w = factWhere(f, "p");
  return q<{ payment_status: string; invoices: number; paid: number; outstanding: number }>(
    `
    SELECT p.payment_status, COUNT(*) AS invoices,
           SUM(p.amount_paid) AS paid, SUM(p.amount_outstanding) AS outstanding
    FROM fact_fee_payment p
    WHERE 1 = 1${w.sql}
    GROUP BY p.payment_status
    ORDER BY FIELD(p.payment_status, 'Paid', 'Part-paid', 'Unpaid')`,
    w.params,
  );
}

export async function monthlyCollections(f: Filters) {
  const w = factWhere(f, "p");
  return q<{ month: string; paid: number }>(
    `
    SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS month, SUM(p.amount_paid) AS paid
    FROM fact_fee_payment p
    WHERE p.payment_date IS NOT NULL${w.sql}
    GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m')
    ORDER BY month`,
    w.params,
  );
}

export async function outstandingByProgramme(f: Filters) {
  const w = factWhere(f, "p");
  return q<Money & { department: string; faculty: string; debtors: number }>(
    `
    SELECT d.department_name AS department, d.faculty_name AS faculty,
           SUM(p.amount_billed) AS billed, SUM(p.amount_paid) AS paid,
           SUM(p.amount_outstanding) AS outstanding,
           COUNT(DISTINCT CASE WHEN p.amount_outstanding > 0 THEN p.student_key END) AS debtors
    FROM fact_fee_payment p
    JOIN dim_department d ON d.department_key = p.department_key
    WHERE 1 = 1${w.sql}
    GROUP BY d.department_key, d.department_name, d.faculty_name
    ORDER BY outstanding DESC
    LIMIT 8`,
    w.params,
  );
}
