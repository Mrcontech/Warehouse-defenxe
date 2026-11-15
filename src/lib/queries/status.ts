import "server-only";
import { isConnectionError, isMissingTable, query, queryOne } from "@/lib/db";

export type LastRun = { run_id: number; finished_at: string; duration_ms: number; triggered_by: string };
export type WarehouseStatus =
  | { state: "offline"; message: string }
  | { state: "empty"; message: string }
  | { state: "ready"; lastRun: LastRun | null };

/** Is MySQL reachable, and has the ETL loaded the warehouse? */
export async function warehouseStatus(): Promise<WarehouseStatus> {
  try {
    const rows = await query<{ n: number }>("SELECT COUNT(*) AS n FROM fact_enrolment");
    if (!rows[0]?.n) return { state: "empty", message: "The warehouse tables exist but hold no data yet." };
    const lastRun = await queryOne<LastRun>(
      "SELECT run_id, finished_at, duration_ms, triggered_by FROM etl_run WHERE status = 'success' ORDER BY run_id DESC LIMIT 1",
    );
    return { state: "ready", lastRun };
  } catch (e) {
    if (isMissingTable(e) || (e as { code?: string })?.code === "ER_BAD_DB_ERROR") {
      return { state: "empty", message: "The warehouse has not been loaded yet." };
    }
    if (isConnectionError(e)) {
      return { state: "offline", message: "MySQL is not running. Start it in the XAMPP Control Panel, then refresh this page." };
    }
    throw e;
  }
}
