import { Activity } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartTooltip,
  PALETTE,
  WidgetCard,
  WidgetHeader,
  WidgetLoading,
  cfgBool,
  cfgNumber,
  cfgString,
} from "./shared";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

function tickTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

/** Gráfica de líneas: una serie por cada clave del datasource. */
export function LineChartRenderer({ widget, config, data }: WidgetRendererProps) {
  const windowMin = cfgNumber(config, "windowMinutes", 1440);
  const showLegend = cfgBool(config, "showLegend", false);
  const color = cfgString(config, "color", "#0891b2");
  const unit = cfgString(config, "unit", "");
  const cutoff = Date.now() - windowMin * 60_000;

  const activeKeys = Object.keys(data.series).filter(
    (k) => (data.series[k] ?? []).some((p) => p.ts >= cutoff),
  );
  const keys = activeKeys.length > 0 ? activeKeys : Object.keys(data.series).slice(0, 3);
  const loading = data.loading && keys.length === 0;

  // Puntos fusionados por timestamp para soportar multi-clave
  const byTs = new Map<number, Record<string, number>>();
  for (const key of keys) {
    for (const p of data.series[key] ?? []) {
      if (p.ts < cutoff) continue;
      const row = byTs.get(p.ts) ?? { ts: p.ts };
      row[key] = p.value;
      byTs.set(p.ts, row);
    }
  }
  const rows = Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);

  const thresholds = data.device?.thresholds?.[keys[0] ?? ""];

  return (
    <WidgetCard>
      <WidgetHeader
        widget={widget}
        icon={Activity}
        color={color}
        subtitle={keys.length > 1 ? `${keys.length} series` : keys[0] || undefined}
      />
      {loading ? (
        <WidgetLoading />
      ) : (
        <div className="mt-2 min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={tickTime}
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
              <Tooltip content={<ChartTooltip unit={unit} />} />
              {thresholds?.max !== undefined && (
                <ReferenceLine
                  y={thresholds.max}
                  stroke="#dc2626"
                  strokeDasharray="5 4"
                  label={{ value: `máx ${thresholds.max}`, fill: "#dc2626", fontSize: 9, position: "insideTopRight" }}
                />
              )}
              {thresholds?.min !== undefined && (
                <ReferenceLine
                  y={thresholds.min}
                  stroke="#2563eb"
                  strokeDasharray="5 4"
                  label={{ value: `mín ${thresholds.min}`, fill: "#2563eb", fontSize: 9, position: "insideTopRight" }}
                />
              )}
              {keys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {showLegend && keys.length > 0 ? <Legend keys={keys} /> : null}
        </div>
      )}
    </WidgetCard>
  );
}

function Legend({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 px-2 pt-1">
      {keys.map((key, i) => (
        <span key={key} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
          />
          {key}
        </span>
      ))}
    </div>
  );
}
