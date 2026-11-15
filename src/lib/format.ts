// Number formatting for the dashboard (Nigerian conventions: naira, comma thousands).

const int = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

export const num = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "–" : int.format(Math.round(n)));
export const dec1 = (n: number | null | undefined) => (n == null ? "–" : n.toFixed(1));
export const dec2 = (n: number | null | undefined) => (n == null ? "–" : n.toFixed(2));
export const pct = (n: number | null | undefined, digits = 1) => (n == null ? "–" : `${n.toFixed(digits)}%`);

/** ₦636.1m, ₦2.51bn, ₦12,000. */
export function naira(n: number | null | undefined, opts: { exact?: boolean } = {}): string {
  if (n == null) return "–";
  if (opts.exact) return `₦${int.format(Math.round(n))}`;
  const a = Math.abs(n);
  if (a >= 1e9) return `₦${(n / 1e9).toFixed(2)}bn`;
  if (a >= 1e6) return `₦${(n / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `₦${(n / 1e3).toFixed(0)}k`;
  return `₦${int.format(n)}`;
}

/** Short axis labels: 1.2K, 3.4M. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return String(Math.round(n));
}

/** Percentage change of a against b, or null when there is nothing to compare. */
export function delta(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return ((a - b) / b) * 100;
}

export function formatDateTime(s: string | null | undefined): string {
  if (!s) return "–";
  const d = new Date(s.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "–";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
