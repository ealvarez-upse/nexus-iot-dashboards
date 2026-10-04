import { Activity } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip, WidgetCard, WidgetHeader, WidgetLoading } from "./shared";
import { cfgNumber, cfgString } from "./widget-utils";
import { windowedSeries } from "@/lib/dashboard/seriesWindow";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

function tickTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

/** Gráfica de área con gradiente (identidad visual de IMIND). */
export function AreaChartRenderer({ widget, config, data }: WidgetRendererProps) {
  const windowMin = cfgNumber(config, "windowMinutes", 1440);
  const color = cfgString(config, "color", "#0891b2");
  const unit = cfgString(config, "unit", "");

  // Ventana derivada de los datos (no de Date.now): estable entre renders.
  const allKeys = Object.keys(data.series);
  const key = allKeys[0] ?? "";
  const rows = windowedSeries(data.series[key], windowMin);
  const loading = data.loading && rows.length === 0;
  const thresholds = data.device?.thresholds?.[key];

  return (
    <WidgetCard>
      <WidgetHeader widget={widget} icon={Activity} color={color} subtitle={key || undefined} />
      {loading ? (
        <WidgetLoading />
      ) : (
        <div className="mt-2 min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id={`grad-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
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
    </WidgetCard>
  );
}
