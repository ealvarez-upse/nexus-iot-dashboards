import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetCard, WidgetHeader, WidgetLoading } from "./shared";
import {
  cfgBool,
  cfgNumber,
  cfgString,
  firstSeries,
  formatValue,
  keyIconFor,
} from "./widget-utils";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

function aggregate(
  values: number[],
  agg: string,
): number | undefined {
  if (values.length === 0) return undefined;
  switch (agg) {
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return values[values.length - 1];
  }
}

const AGG_LABEL: Record<string, string> = {
  last: "Último valor",
  avg: "Promedio",
  min: "Mínimo",
  max: "Máximo",
};

/** KPI: agregado de la ventana configurada + tendencia vs ventana previa. */
export function KpiRenderer({ widget, config, data }: WidgetRendererProps) {
  const { key, points } = firstSeries(data, []);
  const agg = cfgString(config, "aggregation", "last");
  const windowMin = cfgNumber(config, "windowMinutes", 60);
  const showDelta = cfgBool(config, "showDelta", true);
  const unit = cfgString(config, "unit", "");
  const decimals = cfgNumber(config, "decimals", 2);
  const color = cfgString(config, "color", "#0891b2");
  const Icon = keyIconFor(key);

  // Ventanas derivadas de los datos (no de Date.now): "ahora" = último
  // timestamp observado; la ventana previa es el mismo largo inmediatamente
  // antes. Estable entre renders y refleja la ventana del batch de datos.
  const lastTs = points.length > 0 ? points[points.length - 1].ts : 0;
  const windowMs = windowMin * 60_000;
  const current = points.filter((p) => p.ts >= lastTs - windowMs);
  const previous = points.filter(
    (p) => p.ts >= lastTs - windowMs * 2 && p.ts < lastTs - windowMs,
  );

  const value = aggregate(current.map((p) => p.value), agg);
  const prevValue = aggregate(previous.map((p) => p.value), agg);

  let deltaPct: number | undefined;
  if (showDelta && value !== undefined && prevValue !== undefined && prevValue !== 0) {
    deltaPct = ((value - prevValue) / Math.abs(prevValue)) * 100;
  }
  const deltaLabel =
    deltaPct === undefined ? undefined : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`;

  return (
    <WidgetCard>
      <WidgetHeader
        widget={widget}
        icon={Icon}
        color={color}
        subtitle={`${AGG_LABEL[agg] ?? agg} · ${windowMin < 60 ? `${windowMin} min` : `${Math.round(windowMin / 60)} h`}`}
      />
      <div className="flex flex-1 flex-col justify-center gap-2">
        {data.loading ? (
          <WidgetLoading />
        ) : (
          <p className="font-mono text-3xl font-bold tracking-tight md:text-4xl">
            {formatValue(value, decimals, unit)}
          </p>
        )}
        {deltaLabel !== undefined && value !== undefined ? (
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              deltaPct === undefined
                ? "bg-muted text-muted-foreground"
                : deltaPct > 0
                  ? "bg-warning/15 text-warning"
                  : "bg-success/15 text-success",
            )}
          >
            {deltaPct === undefined ? (
              <Minus className="size-3" />
            ) : deltaPct > 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {deltaLabel} vs periodo anterior
          </span>
        ) : null}
      </div>
    </WidgetCard>
  );
}
