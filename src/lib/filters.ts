import "server-only";
import { query } from "@/lib/db";

export type SessionOption = { key: number; name: string; slug: string; isCurrent: boolean; startYear: number };
export type FacultyOption = { key: number; code: string; name: string; short: string };

export type Filters = {
  session: SessionOption | null; // null = all sessions
  faculty: FacultyOption | null; // null = all faculties
  previous: SessionOption | null; // session before the selected one, for deltas
  sessions: SessionOption[];
  faculties: FacultyOption[];
};

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function shortFaculty(name: string): string {
  return name
    .replace(/^Faculty of /, "")
    .replace("Agriculture and Natural Resources Management", "Agriculture")
    .replace("Engineering and Environmental Science", "Engineering")
    .replace("Health Sciences and Technology", "Health Sciences")
    .replace("Social Sciences and Humanities", "Social Sciences")
    .replace("Management Sciences", "Management")
    .replace("Basic Medical Sciences", "Basic Medical");
}

export async function loadOptions() {
  const [sessions, faculties] = await Promise.all([
    query<{ session_key: number; session_name: string; is_current: number; start_year: number }>(
      "SELECT session_key, session_name, is_current, start_year FROM dim_session ORDER BY start_year",
    ),
    query<{ faculty_key: number; faculty_code: string; faculty_name: string }>(
      "SELECT faculty_key, faculty_code, faculty_name FROM dim_faculty ORDER BY faculty_name",
    ),
  ]);
  return {
    sessions: sessions.map((s) => ({
      key: s.session_key,
      name: s.session_name,
      slug: s.session_name.replace("/", "-"),
      isCurrent: s.is_current === 1,
      startYear: s.start_year,
    })),
    faculties: faculties.map((f) => ({
      key: f.faculty_key,
      code: f.faculty_code,
      name: f.faculty_name,
      short: shortFaculty(f.faculty_name),
    })),
  };
}

export async function resolveFilters(searchParams: SearchParams): Promise<Filters> {
  const sp = await searchParams;
  const { sessions, faculties } = await loadOptions();
  const sParam = typeof sp.session === "string" ? sp.session : undefined;
  const fParam = typeof sp.faculty === "string" ? sp.faculty : undefined;

  let session: SessionOption | null;
  if (sParam === "all") session = null;
  else session = sessions.find((s) => s.slug === sParam) ?? sessions.find((s) => s.isCurrent) ?? sessions.at(-1) ?? null;

  const faculty = faculties.find((f) => f.code === fParam) ?? null;
  const idx = session ? sessions.findIndex((s) => s.key === session.key) : -1;
  const previous = idx > 0 ? sessions[idx - 1] : null;
  return { session, faculty, previous, sessions, faculties };
}

/** Builds "AND x.session_key = ? AND x.faculty_key = ?" for a fact alias. */
export function factWhere(f: Pick<Filters, "session" | "faculty">, alias: string, opts: { session?: boolean } = {}) {
  const parts: string[] = [];
  const params: number[] = [];
  if (opts.session !== false && f.session) {
    parts.push(`${alias}.session_key = ?`);
    params.push(f.session.key);
  }
  if (f.faculty) {
    parts.push(`${alias}.faculty_key = ?`);
    params.push(f.faculty.key);
  }
  return { sql: parts.length ? " AND " + parts.join(" AND ") : "", params };
}

export function filterLabel(f: Pick<Filters, "session" | "faculty">) {
  const s = f.session ? f.session.name : "All sessions";
  const fac = f.faculty ? f.faculty.short : "All faculties";
  return `${s}, ${fac}`;
}
