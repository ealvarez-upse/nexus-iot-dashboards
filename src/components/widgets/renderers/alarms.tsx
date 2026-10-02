import { BellOff, BellRing } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WidgetCard, WidgetHeader, cfgStringSafe } from "./shared";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

/**
 * Widget LEGACY v1 "alarms": lista de alarmas activas del dispositivo.
 * No aparece en la biblioteca nueva; existe solo para que los dashboards
 * migrados sigan mostrando su contenido.
 */
export function LegacyAlarmsRenderer({ widget, data }: WidgetRendererProps) {
  const color = cfgStringSafe(widget.configuration);

  return (
    <WidgetCard>
      <WidgetHeader widget={widget} icon={BellRing} color={color} subtitle="alarmas activas" />
      <div className="mt-3 flex flex-col gap-2 overflow-auto">
        {data.loading ? (
          <p className="animate-pulse text-xs text-muted-foreground">Cargando alarmas…</p>
        ) : data.alarms.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3">
            <BellOff className="size-4 text-success" />
            <p className="text-sm text-success">Sin alarmas activas</p>
          </div>
        ) : (
          data.alarms.map((a) => (
            <div
              key={a._id}
              className={cn(
                "flex items-center gap-2 rounded-lg p-2.5",
                a.severity === "critical" ? "bg-destructive/10" : "bg-warning/15",
              )}
            >
              <BellRing
                className={cn(
                  "size-4 shrink-0",
                  a.severity === "critical" ? "text-destructive" : "text-warning",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {a.dataKey} {a.type === "max" ? "sobre" : "bajo"} {a.threshold}
                </p>
                <p className="text-[11px] text-muted-foreground">{timeAgo(a.startTs)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </WidgetCard>
  );
}
