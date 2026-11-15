import "server-only";
import { filterLabel, resolveFilters, type SearchParams } from "@/lib/filters";
import { formatDateTime } from "@/lib/format";
import { warehouseStatus } from "@/lib/queries/status";

/** What every dashboard tab needs: warehouse status, resolved filters and the frame's options. */
export async function dashboardContext(searchParams: SearchParams) {
  const status = await warehouseStatus();
  if (status.state !== "ready") return { ready: false as const, status };
  const f = await resolveFilters(searchParams);
  const frame = {
    sessions: [...f.sessions.map((s) => ({ value: s.slug, label: s.name })), { value: "all", label: "All sessions" }],
    faculties: f.faculties.map((x) => ({ value: x.code, label: x.short })),
    session: f.session ? f.session.slug : "all",
    faculty: f.faculty?.code ?? "",
    loaded: status.lastRun ? `Loaded ${formatDateTime(status.lastRun.finished_at)} by ETL run #${status.lastRun.run_id}` : null,
  };
  return { ready: true as const, status, f, frame, label: filterLabel(f) };
}
