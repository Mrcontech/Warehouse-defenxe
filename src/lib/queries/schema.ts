import "server-only";
import { query } from "@/lib/db";

export const STAR_TABLES = [
  { name: "fact_enrolment", kind: "fact", grain: "One student registered in one session." },
  { name: "fact_fee_payment", kind: "fact", grain: "One fee item billed to one student in one session (an invoice line)." },
  { name: "fact_result", kind: "fact", grain: "One student's result in one course in one session." },
  { name: "dim_student", kind: "dimension", grain: "One simulated student." },
  { name: "dim_course", kind: "dimension", grain: "One course in the examination catalogue." },
  { name: "dim_department", kind: "dimension", grain: "One programme (department)." },
  { name: "dim_faculty", kind: "dimension", grain: "One faculty." },
  { name: "dim_session", kind: "dimension", grain: "One academic session." },
] as const;

export type SchemaColumn = { name: string; type: string; key: "PK" | "FK" | "NK" | ""; comment: string; references: string | null };
export type SchemaTable = {
  name: string; kind: "fact" | "dimension"; grain: string; comment: string; rows: number;
  columns: SchemaColumn[]; sample: Record<string, unknown>[];
};

/** The star schema as the database itself describes it, with live row counts and sample rows. */
export async function loadSchema(database = process.env.DB_NAME || "ebsu_dw"): Promise<SchemaTable[]> {
  const names = STAR_TABLES.map((t) => t.name);
  const placeholders = names.map(() => "?").join(", ");
  const [tables, columns, refs] = await Promise.all([
    query<{ TABLE_NAME: string; TABLE_COMMENT: string }>(
      `SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders})`,
      [database, ...names],
    ),
    query<{ TABLE_NAME: string; COLUMN_NAME: string; COLUMN_TYPE: string; COLUMN_KEY: string; COLUMN_COMMENT: string; ORDINAL_POSITION: number }>(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLUMN_KEY, COLUMN_COMMENT, ORDINAL_POSITION
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders}) ORDER BY ORDINAL_POSITION`,
      [database, ...names],
    ),
    query<{ TABLE_NAME: string; COLUMN_NAME: string; REFERENCED_TABLE_NAME: string }>(
      `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [database],
    ),
  ]);
  const comment = new Map(tables.map((t) => [t.TABLE_NAME, t.TABLE_COMMENT]));
  const fk = new Map(refs.map((r) => [`${r.TABLE_NAME}.${r.COLUMN_NAME}`, r.REFERENCED_TABLE_NAME]));
  const out: SchemaTable[] = [];
  for (const t of STAR_TABLES) {
    const pk = columns.find((c) => c.TABLE_NAME === t.name && c.COLUMN_KEY === "PRI")?.COLUMN_NAME ?? "1";
    const [[count], sample] = await Promise.all([
      query<{ n: number }>(`SELECT COUNT(*) AS n FROM \`${t.name}\``),
      query<Record<string, unknown>>(`SELECT * FROM \`${t.name}\` ORDER BY \`${pk}\` LIMIT 5`),
    ]);
    out.push({
      name: t.name, kind: t.kind, grain: t.grain, comment: comment.get(t.name) ?? "", rows: count?.n ?? 0, sample,
      columns: columns.filter((c) => c.TABLE_NAME === t.name).map((c) => {
        const references = fk.get(`${t.name}.${c.COLUMN_NAME}`) ?? null;
        const key = c.COLUMN_KEY === "PRI" ? "PK" : references ? "FK" : c.COLUMN_KEY === "UNI" && t.kind === "dimension" ? "NK" : "";
        return { name: c.COLUMN_NAME, type: c.COLUMN_TYPE, key, comment: c.COLUMN_COMMENT, references };
      }),
    });
  }
  return out;
}
