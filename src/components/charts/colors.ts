// Chart colours, shared by server and client components (no "use client" here on purpose:
// a server component importing from a client module only gets a reference, not the values).
export const COLORS = {
  series1: "#2f6fa3", // collected, passes, enrolment
  series1Light: "#a9c4dc",
  series2: "#d9443e", // outstanding, the one thing to look at
  series2Light: "#f0b3ae",
  deemph: "#d3ccc4",
  ink: "#1f1d1b",
  muted: "#6f6a64",
  grid: "#e6e1db",
  good: "#1e6f41",
  warn: "#7d5300",
  bad: "#a3302b",
} as const;

export type ValueFormat = "int" | "naira" | "pct" | "dec2" | "compact";

const trim = (s: string) => s.replace(/\.0(?=[a-zA-Z]|$)/, "");

/** Round, evenly spaced axis ticks (steps of 1, 2, 2.5 or 5 times a power of ten) from 0 to just above max. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Number((i * step).toFixed(6)));
}

export function fmtValue(v: number | null | undefined, f: ValueFormat): string {
  if (v == null || Number.isNaN(v)) return "–";
  switch (f) {
    case "naira": {
      const a = Math.abs(v);
      if (a >= 1e9) return `₦${(v / 1e9).toFixed(2)}bn`;
      if (a >= 1e6) return trim(`₦${(v / 1e6).toFixed(1)}m`);
      if (a >= 1e3) return `₦${Math.round(v / 1e3)}k`;
      return `₦${Math.round(v)}`;
    }
    case "pct":
      return `${v.toFixed(1)}%`;
    case "dec2":
      return v.toFixed(2);
    case "compact": {
      const a = Math.abs(v);
      if (a >= 1e6) return trim(`${(v / 1e6).toFixed(1)}M`);
      if (a >= 1e3) return trim(`${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`);
      return String(Math.round(v));
    }
    default:
      return new Intl.NumberFormat("en-NG").format(Math.round(v));
  }
}
