import "server-only";
import { query } from "@/lib/db";

/** The SQL a chart shows in its SQL view: parameters inlined, noise removed, indentation trimmed. */
export function displaySql(sql: string, params: unknown[]): string {
  let i = 0;
  let text = sql.replace(/\?/g, () => {
    const v = params[i++];
    return typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
  });
  text = text.replace(/WHERE 1 = 1 AND /g, "WHERE ").replace(/\n\s*WHERE 1 = 1(?=\s*\n|\s*$)/g, "");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const indent = Math.min(...lines.map((l) => l.match(/^\s*/)![0].length));
  return lines.map((l) => l.slice(indent)).join("\n").trim();
}

export type Q<T> = { rows: T[]; sql: string };

/** Runs a query and keeps the readable SQL beside its rows, for the chart cards' SQL view. */
export async function q<T>(sql: string, params: unknown[] = []): Promise<Q<T>> {
  const rows = await query<T>(sql, params);
  return { rows, sql: displaySql(sql, params) };
}
