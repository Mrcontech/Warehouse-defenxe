import "server-only";
import mysql from "mysql2/promise";

// One pool for the whole server process (kept on globalThis so dev reloads reuse it).
const g = globalThis as unknown as { __ebsuPool?: mysql.Pool };

export function pool(): mysql.Pool {
  if (!g.__ebsuPool) {
    g.__ebsuPool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "ebsu_dw",
      connectionLimit: 8,
      decimalNumbers: true,
      dateStrings: true,
      supportBigNumbers: true,
      connectTimeout: 4000,
    });
  }
  return g.__ebsuPool;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool().query(sql, params);
  return rows as T[];
}

export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Runs a query and reports how long the database took, for the live benchmark. */
export async function timedQuery<T>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; ms: number }> {
  const t0 = performance.now();
  const rows = await query<T>(sql, params);
  return { rows, ms: performance.now() - t0 };
}

export function isConnectionError(e: unknown): boolean {
  const code = (e as { code?: string })?.code ?? "";
  return ["ECONNREFUSED", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST", "ENOTFOUND", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR"].includes(code);
}

export function isMissingTable(e: unknown): boolean {
  return (e as { code?: string })?.code === "ER_NO_SUCH_TABLE";
}
