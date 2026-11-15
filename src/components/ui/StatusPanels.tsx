import Link from "next/link";
import { DatabaseIcon, PlugsIcon } from "@phosphor-icons/react/ssr";

export function OfflinePanel({ message }: { message: string }) {
  return (
    <div className="card mx-auto mt-10 max-w-xl p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-[14px] bg-bad-soft text-bad"><PlugsIcon size={24} /></span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">The database is offline</h2>
      <p className="mt-2 text-muted">{message}</p>
    </div>
  );
}

export function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="card mx-auto mt-10 max-w-xl p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-[14px] bg-accent-soft text-accent-ink"><DatabaseIcon size={24} /></span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">No data in the warehouse yet</h2>
      <p className="mt-2 text-muted">{message} Run the ETL to load the simulated source files.</p>
      <Link href="/etl" className="press mt-6 inline-flex rounded-full bg-night px-5 py-2.5 text-sm font-medium text-[#fff8f5]">Go to the ETL Pipeline</Link>
    </div>
  );
}
