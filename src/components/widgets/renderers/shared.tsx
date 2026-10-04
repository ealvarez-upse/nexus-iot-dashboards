/**
 * Piezas visuales compartidas por los renderers de widgets.
 * SOLO componentes React (react-refresh/only-export-components): las
 * utilidades y constantes viven en widget-utils.ts.
 */

import type { LucideIcon } from "lucide-react";
import { formatTime } from "@/lib/format";
import type { Widget } from "@/lib/dashboard/model";

/** Encabezado estándar del widget (identidad visual común). */
export function WidgetHeader({
  widget,
  icon,
  color,
  subtitle,
  showTitle = true,
}: {
  widget: Widget;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
  showTitle?: boolean;
}) {
  const Icon = icon;
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0">
        {showTitle ? (
          <p className="truncate text-sm font-semibold leading-tight">{widget.title}</p>
        ) : null}
        <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {subtitle ?? widget.datasourceIds.length}
        </p>
      </div>
    </div>
  );
}

/** Tooltip común para gráficas recharts. */
export function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: { ts: number; value: number } }>;
  unit?: string;
}) {
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

/** Contenedor glass estándar de todo widget. */
export function WidgetCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass flex h-full flex-col overflow-hidden rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

/** Estado vacío/cargando dentro del widget. */
export function WidgetLoading({ label = "Cargando datos…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <span className="animate-pulse text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
