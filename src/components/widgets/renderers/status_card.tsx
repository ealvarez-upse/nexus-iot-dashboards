import { cn } from "@/lib/utils";
import { WidgetCard, WidgetHeader, WidgetLoading } from "./shared";
import {
  cfgBool,
  cfgNumber,
  cfgOptionalNumber,
  cfgString,
  formatValue,
  keyIconFor,
  latestValueOf,
} from "./widget-utils";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

type Status = "ok" | "warn" | "crit";

const STATUS_META: Record<Status, { label: string; className: string }> = {
  ok: { label: "Normal", className: "bg-success/15 text-success" },
  warn: { label: "Alerta", className: "bg-warning/20 text-warning" },
  crit: { label: "Crítico", className: "bg-destructive/15 text-destructive" },
};

function statusOf(
  value: number | undefined,
  cfg: Record<string, unknown>,
): Status {
  if (value === undefined) return "ok";
  const critBelow = cfgOptionalNumber(cfg, "critBelow");
  const critAbove = cfgOptionalNumber(cfg, "critAbove");
  const warnBelow = cfgOptionalNumber(cfg, "warnBelow");
  const warnAbove = cfgOptionalNumber(cfg, "warnAbove");
  if (
    (critBelow !== undefined && value < critBelow) ||
    (critAbove !== undefined && value > critAbove)
  ) {
    return "crit";
  }
  if (
    (warnBelow !== undefined && value < warnBelow) ||
    (warnAbove !== undefined && value > warnAbove)
  ) {
    return "warn";
  }
  return "ok";
}

/** Status Card: valor actual + estado semántico según rangos configurados. */
export function StatusCardRenderer({ widget, config, data }: WidgetRendererProps) {
  const { key, value } = latestValueOf(data);
  const unit = cfgString(config, "unit", "");
  const decimals = cfgNumber(config, "decimals", 2);
  const color = cfgString(config, "color", "#0891b2");
  const showIcon = cfgBool(config, "showIcon", true);
  const showTitle = cfgBool(config, "showTitle", true);
  const status = statusOf(value, config);
  const meta = STATUS_META[status];
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
      <div className="flex flex-1 flex-col justify-center gap-3">
        {data.loading ? (
          <WidgetLoading />
        ) : (
          <p className="font-mono text-3xl font-bold tracking-tight md:text-4xl">
            {formatValue(value, decimals, unit)}
          </p>
        )}
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            meta.className,
          )}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {meta.label}
        </span>
      </div>
    </WidgetCard>
  );
}
