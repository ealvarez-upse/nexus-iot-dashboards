import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime } from "@/lib/format";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import type { WidgetConfig } from "./types";
import { Activity, BatteryCharging, Droplets, Thermometer, Gauge as GaugeIcon, Minus } from "lucide-react";

function keyIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes("temp")) return Thermometer;
  if (k.includes("hum")) return Droplets;
  if (k.includes("bat")) return BatteryCharging;
  if (k.includes("press")) return GaugeIcon;
  return Activity;
}

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: Array<{ payload: { ts: number; value: number } }>; unit?: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-mono text-sm font-semibold text-foreground">
        {point.value}
        {unit ? <span className="ml-0.5 text-muted-foreground">{unit}</span> : null}
      </p>
      <p className="mt-0.5 text-muted-foreground">{formatTime(point.ts)}</p>
    </div>
  );
}

function CurrentValue({ value, unit }: { value: number | undefined; unit?: string }) {
  if (value === undefined) {
    return <span className="font-mono text-4xl font-bold text-muted-foreground/40">—</span>;
  }
  return (
    <div className="flex items-baseline gap-1">
      <span className="font-mono text-4xl font-bold tracking-tight">{value.toLocaleString("es", { maximumFractionDigits: 2 })}</span>
      {unit ? <span className="text-lg font-medium text-muted-foreground">{unit}</span> : null}
    </div>
  );
}

export function TelemetryWidget({
  widget,
  unit,
  onRemove,
}: {
  widget: WidgetConfig;
  unit?: string;
  onRemove?: () => void;
}) {
  const series = useQuery(api.devices.latestSeries, {
    deviceId: widget.deviceId,
    keys: [widget.dataKey],
    limit: 240,
  }) as Record<string, { ts: number; value: number }[]> | undefined;

  const data = series?.[widget.dataKey] ?? [];
  const current = data.at(-1)?.value;
  const Icon = keyIcon(widget.dataKey);
  const color = widget.color ?? "#0891b2";
  const resolvedUnit = unit ?? widget.unit ?? "";

  if (series === undefined) {
    return (
      <Card className="card-layered p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-4 h-10 w-1/2" />
        <Skeleton className="mt-4 h-24 w-full" />
      </Card>
    );
  }

  return (
    <Card className="card-layered group relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <Icon className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{widget.title}</p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {widget.dataKey}
            </p>
          </div>
        </div>
        {onRemove ? (
          <button
            onClick={onRemove}
            aria-label="Eliminar widget"
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
          >
            <Minus className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        {widget.type === "valueCard" && <CurrentValue value={current} unit={resolvedUnit} />}
        {widget.type === "gauge" && (
          <div className="relative mx-auto h-40 w-full max-w-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                data={[{ value: Math.max(0, Math.min(100, current ?? 0)) }]}
                innerRadius="72%"
                outerRadius="100%"
                startAngle={210}
                endAngle={-30}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={10} fill={color} background={{ fill: "currentColor", className: "text-muted" }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <CurrentValue value={current} unit={resolvedUnit} />
            </div>
          </div>
        )}
        {widget.type === "timeSeries" && (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id={`grad-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="ts"
                  tickFormatter={(ts: number) => formatTime(ts)}
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={48}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<ChartTooltip unit={resolvedUnit} />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#grad-${widget.id})`}
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
