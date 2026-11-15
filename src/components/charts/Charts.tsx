"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { COLORS, fmtValue, niceTicks, type ValueFormat } from "./colors";

export type Series = { key: string; name: string; color: string };
type Row = Record<string, string | number | null>;

const AXIS = { fontSize: 12, fill: COLORS.muted };

function TooltipBox({ active, payload, label, format, series }: {
  active?: boolean; payload?: readonly { dataKey?: unknown; value?: unknown }[]; label?: unknown; format: ValueFormat; series: Series[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-sm">
      <div className="mb-1 font-medium text-ink">{String(label ?? "")}</div>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <div key={String(p.dataKey)} className="flex items-center gap-2 text-ink-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: s?.color ?? COLORS.series1 }} />
            <span>{s?.name ?? String(p.dataKey)}</span>
            <span className="tnum ml-auto pl-3 font-medium text-ink">{fmtValue(Number(p.value), format)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[3px]" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function CategoryTick({ x, y, payload, width }: { x?: number | string; y?: number | string; payload?: { value: string }; width: number }) {
  const text = String(payload?.value ?? "");
  const max = Math.floor(width / 7.2);
  const shown = text.length > max ? text.slice(0, max - 1) + "…" : text;
  return (
    <text x={Number(x ?? 0) - 10} y={Number(y ?? 0)} dy={4} textAnchor="end" fontSize={13} fill={COLORS.ink}>
      <title>{text}</title>
      {shown}
    </text>
  );
}

/** Horizontal bars: rankings by faculty or department. Stacked when two series are given. */
export function HBars({
  data, series, format = "int", stacked = false, endKey, endSuffix = "", labelWidth = 128,
}: {
  data: Row[]; series: Series[]; format?: ValueFormat; stacked?: boolean; endKey?: string; endSuffix?: string; labelWidth?: number;
}) {
  const height = Math.max(120, data.length * 38 + 12);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: endKey ? 96 : 52, bottom: 0, left: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="label" width={labelWidth} tickLine={false} axisLine={false}
            tick={(p) => <CategoryTick {...p} width={labelWidth} />} interval={0} />
          <Tooltip cursor={{ fill: "rgba(31,29,27,0.04)" }} content={(p) => <TooltipBox {...p} format={format} series={series} />} />
          {series.map((s, i) => {
            const last = i === series.length - 1;
            return (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId={stacked ? "a" : undefined} fill={s.color} barSize={18}
                radius={!stacked || last ? [0, 4, 4, 0] : 0} stroke="#fcfbfa" strokeWidth={stacked ? 1 : 0} isAnimationActive={false}>
                {last && (
                  <LabelList dataKey={endKey ?? s.key} position="right" offset={8}
                    formatter={(v: unknown) => fmtValue(Number(v), format) + endSuffix}
                    style={{ fontSize: 12.5, fill: COLORS.ink }} />
                )}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vertical columns: distributions and sessions. The focus column keeps full colour; the rest are lighter. */
export function Columns({
  data, series, format = "int", axisFormat = "compact", stacked = false, totalKey, focusLabel, height = 260,
}: {
  data: Row[]; series: Series[]; format?: ValueFormat; axisFormat?: ValueFormat; stacked?: boolean; totalKey?: string;
  focusLabel?: string; height?: number;
}) {
  const max = Math.max(0, ...data.map((d) => totalKey ? Number(d[totalKey] ?? 0)
    : stacked ? series.reduce((a, s) => a + Number(d[s.key] ?? 0), 0) : Math.max(...series.map((s) => Number(d[s.key] ?? 0)))));
  const ticks = niceTicks(max);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={COLORS.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval={0} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS} width={axisFormat === "naira" ? 62 : 44}
            ticks={ticks} domain={[0, ticks[ticks.length - 1]]} interval={0} tickFormatter={(v: number) => fmtValue(v, axisFormat)} />
          <Tooltip cursor={{ fill: "rgba(31,29,27,0.04)" }} content={(p) => <TooltipBox {...p} format={format} series={series} />} />
          {series.map((s, i) => {
            const last = i === series.length - 1;
            return (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId={stacked ? "a" : undefined} fill={s.color} maxBarSize={44}
                radius={!stacked || last ? [4, 4, 0, 0] : 0} stroke="#fcfbfa" strokeWidth={stacked ? 1 : 0} isAnimationActive={false}>
                {data.map((d, j) => (
                  <Cell key={j} fillOpacity={focusLabel && d.label !== focusLabel ? 0.42 : 1} />
                ))}
                {last && (
                  <LabelList dataKey={totalKey ?? s.key} position="top" offset={6}
                    formatter={(v: unknown) => fmtValue(Number(v), format)} style={{ fontSize: 12, fill: COLORS.ink }} />
                )}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendArea({ data, series, format = "naira", height = 230 }: { data: Row[]; series: Series; format?: ValueFormat; height?: number }) {
  const ticks = niceTicks(Math.max(0, ...data.map((d) => Number(d[series.key] ?? 0))));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series.color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={series.color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={COLORS.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS} width={62} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} interval={0}
            tickFormatter={(v: number) => fmtValue(v, format)} />
          <Tooltip content={(p) => <TooltipBox {...p} format={format} series={[series]} />} />
          <Area type="monotone" dataKey={series.key} name={series.name} stroke={series.color} strokeWidth={2} fill="url(#areaFill)"
            isAnimationActive={false} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fcfbfa" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLine({ data, series, format = "pct", height = 230, domain }: {
  data: Row[]; series: Series; format?: ValueFormat; height?: number; domain?: [number, number];
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 22, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={COLORS.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} padding={{ left: 18, right: 18 }} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS} width={44} domain={domain ?? ["auto", "auto"]}
            tickFormatter={(v: number) => fmtValue(v, format === "pct" ? "int" : format) + (format === "pct" ? "%" : "")} />
          <Tooltip content={(p) => <TooltipBox {...p} format={format} series={[series]} />} />
          <Line type="monotone" dataKey={series.key} name={series.name} stroke={series.color} strokeWidth={2}
            dot={{ r: 4, fill: series.color, stroke: "#fcfbfa", strokeWidth: 2 }} isAnimationActive={false}>
            <LabelList dataKey={series.key} position="top" offset={10} formatter={(v: unknown) => fmtValue(Number(v), format)}
              style={{ fontSize: 12, fill: COLORS.ink }} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
