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

/** Numeric Card: valor actual grande de la primera clave del datasource. */
export function NumericCardRenderer({ widget, config, data }: WidgetRendererProps) {
  const keys = data.series && Object.keys(data.series).length > 0
    ? Object.keys(data.series)
    : [];
  const { key, points } = firstSeries(data, keys.length > 0 ? keys : []);
  const value = points.length > 0 ? points[points.length - 1].value : data.latest[key];
  const unit = cfgString(config, "unit", "");
  const decimals = cfgNumber(config, "decimals", 2);
  const color = cfgString(config, "color", "#0891b2");
  const showIcon = cfgBool(config, "showIcon", true);
  const showTitle = cfgBool(config, "showTitle", true);
  const Icon = keyIconFor(key);

  return (
    <WidgetCard>
      {showIcon ? (
        <WidgetHeader
          widget={widget}
          icon={Icon}
          color={color}
          showTitle={showTitle}
          subtitle={key || undefined}
        />
      ) : null}
      <div className="flex flex-1 flex-col justify-center">
        {data.loading ? (
          <WidgetLoading />
        ) : (
          <p
            className={cn(
              "font-mono font-bold tracking-tight",
              showIcon ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl",
            )}
          >
            {formatValue(value, decimals, cfgBool(config, "showUnit", true) ? unit : "")}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {data.device?.label || data.device?.name || "Temperatura actual"}
        </p>
      </div>
    </WidgetCard>
  );
}
