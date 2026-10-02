/**
 * Piezas visuales compartidas por todos los renderers de widgets.
 * Mantienen la identidad visual de IMIND IoT (glass, mono, tokens de tema).
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BatteryCharging,
  Droplets,
  Gauge as GaugeIcon,
  Thermometer,
} from "lucide-react";
import { formatTime } from "@/lib/format";
import type { WidgetData } from "@/lib/dashboard/datasource";
import type { Widget } from "@/lib/dashboard/model";

/** Paleta de la plataforma (identidad cyan-teal + semánticos). */
export const PALETTE = [
  "#0891b2", // cian
  "#0d9488", // teal
  "#ca8a04", // ámbar
  "#dc2626", // rojo
  "#7c3aed", // violeta
  "#2563eb", // azul
  "#16a34a", // verde
];

/** Unidad sugerida según el nombre de la clave de telemetría. */
export function suggestUnit(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("temp")) return "°C";
  if (k.includes("hum")) return "%";
  if (k.includes("bat")) return "%";
  if (k.includes("rssi")) return "dBm";
  if (k.includes("press")) return "hPa";
  return "";
}

/** Icono sugerido según la clave de telemetría. */
export function keyIconFor(key: string): LucideIcon {
  const k = (key || "").toLowerCase();
  if (k.includes("temp")) return Thermometer;
  if (k.includes("hum")) return Droplets;
  if (k.includes("bat")) return BatteryCharging;
  if (k.includes("press")) return GaugeIcon;
  return Activity;
}

/* ---------- accesores tipados para `configuration` ---------- */

export function cfgString(
  config: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const v = config[key];
  return typeof v === "string" ? v : fallback;
}

export function cfgNumber(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = config[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function cfgBool(
  config: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const v = config[key];
  return typeof v === "boolean" ? v : fallback;
}

export function cfgOptionalNumber(
  config: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = config[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** cfgString con fallback por defecto (para valores de color). */
export function cfgStringSafe(
  config: Record<string, unknown>,
  key = "color",
  fallback = "#0891b2",
): string {
  const v = config[key];
  return typeof v === "string" ? v : fallback;
}

/** Valor formateado con decimales configurables y sufijo de unidad. */
export function formatValue(value: number | undefined, decimals: number, unit?: string): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  const text = value.toLocaleString("es", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return unit ? `${text} ${unit}` : text;
}

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

/** Extrae la serie plana de la primera clave del datasource. */
export function firstSeries(data: WidgetData, keys: string[]): { points: { ts: number; value: number }[]; key: string } {
  const key = keys[0] ?? "";
  return { key, points: (key && data.series[key]) || [] };
}
