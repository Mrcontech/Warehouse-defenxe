import type { WarehouseStatus } from "@/lib/queries/status";
import { EmptyPanel, OfflinePanel } from "@/components/ui/StatusPanels";

/** Shown instead of a dashboard tab when MySQL is down or the warehouse is empty. */
export function NotReady({ status }: { status: Exclude<WarehouseStatus, { state: "ready" }> }) {
  return status.state === "offline" ? <OfflinePanel message={status.message} /> : <EmptyPanel message={status.message} />;
}
