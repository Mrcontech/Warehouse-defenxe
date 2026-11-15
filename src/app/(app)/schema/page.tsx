import type { Metadata } from "next";
import { SchemaExplorer } from "@/components/schema/SchemaExplorer";
import { PageHeader } from "@/components/shell/PageHeader";
import { SimulatedPill } from "@/components/ui/SimulatedPill";
import { EmptyPanel, OfflinePanel } from "@/components/ui/StatusPanels";
import { isConnectionError, isMissingTable } from "@/lib/db";
import { loadSchema } from "@/lib/queries/schema";

export const metadata: Metadata = { title: "Star Schema" };

async function schemaOrStatus() {
  try {
    const tables = await loadSchema();
    if (tables.every((t) => t.columns.length === 0)) return { state: "empty" as const };
    return { state: "ready" as const, tables };
  } catch (e) {
    if (isMissingTable(e) || (e as { code?: string })?.code === "ER_BAD_DB_ERROR") return { state: "empty" as const };
    if (isConnectionError(e)) return { state: "offline" as const };
    throw e;
  }
}

export default async function SchemaPage() {
  const s = await schemaOrStatus();
  return (
    <>
      <PageHeader title="Star Schema" crumbs={[{ label: "Warehouse" }, { label: "Star Schema" }]} right={<SimulatedPill />} />
      <div className="mt-6">
        {s.state === "offline" && <OfflinePanel message="MySQL is not running. Start it in the XAMPP Control Panel, then refresh this page." />}
        {s.state === "empty" && <EmptyPanel message="The warehouse tables have not been created yet." />}
        {s.state === "ready" && <SchemaExplorer tables={s.tables} />}
      </div>
    </>
  );
}
