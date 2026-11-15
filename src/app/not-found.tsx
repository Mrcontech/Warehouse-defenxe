import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh grid-cols-1 place-items-center p-6">
      <div className="card max-w-md p-8 text-center">
        <p className="text-sm font-medium text-accent-ink">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page does not exist</h1>
        <p className="mt-2 text-muted">Go back to the dashboard to keep exploring the simulated data.</p>
        <Link href="/dashboard" className="press mt-6 inline-flex rounded-full bg-night px-5 py-2.5 text-sm font-medium text-[#fff8f5]">
          Open the dashboard
        </Link>
      </div>
    </main>
  );
}
