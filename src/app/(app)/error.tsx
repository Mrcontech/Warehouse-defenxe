"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-xl p-8 text-center">
      <h2 className="text-xl font-semibold tracking-tight">Something went wrong on this page</h2>
      <p className="mt-2 text-muted">{error.message || "The page could not be loaded."} If MySQL has just been started, try again.</p>
      <button onClick={reset} className="press mt-6 rounded-full bg-night px-5 py-2.5 text-sm font-medium text-[#fff8f5]">Try again</button>
    </div>
  );
}
