import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";
import { WidgetCard, WidgetHeader, WidgetLoading } from "./shared";
import {
  cfgNumber,
  cfgString,
  firstSeries,
  formatValue,
  keyIconFor,
} from "./widget-utils";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

/** Gauge: medidor radial con rango min–max configurable. */
export function GaugeRenderer({ widget, config, data }: WidgetRendererProps) {
  const { key, points } = firstSeries(data, []);
  const value = points.length > 0 ? points[points.length - 1].value : data.latest[key];
  const min = cfgNumber(config, "min", 0);
  const max = cfgNumber(config, "max", 100);
  const decimals = cfgNumber(config, "decimals", 1);
  const unit = cfgString(config, "unit", "");
  const color = cfgString(config, "color", "#0891b2");

  const span = max - min || 1;
  const pct = value === undefined ? 0 : Math.max(0, Math.min(100, ((value - min) / span) * 100));

  return (
    <WidgetCard>
      <WidgetHeader widget={widget} icon={keyIconFor(key)} color={color} subtitle={key || undefined} />
      {data.loading ? (
        <WidgetLoading />
      ) : (
        <div className="relative mx-auto mt-1 min-h-0 w-full flex-1 px-2 pb-1 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              data={[{ value: pct }]}
              innerRadius="72%"
              outerRadius="100%"
              startAngle={210}
              endAngle={-30}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                fill={color}
                background={{ fill: "currentColor", className: "text-muted" }}
                isAnimationActive={false}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-2xl font-bold tracking-tight md:text-3xl">
              {formatValue(value, decimals, unit)}
            </p>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
