/**
 * Utilidades de widgets (sin componentes): paleta, accesores de configuración
 * y helpers de formato. Separadas de shared.tsx para que los archivos que
 * exportan componentes React solo exporten componentes (react-refresh).
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BatteryCharging,
  DoorOpen,
  Droplets,
  Fan,
  Flame,
  Gauge as GaugeIcon,
  Lightbulb,
  Play,
  Power,
  Snowflake,
  Square,
  Thermometer,
  ToggleLeft,
  Zap,
} from "lucide-react";
import type { WidgetData } from "@/lib/dashboard/datasource";

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

/** Catálogo de iconos ofrecidos para Button/Switch (nombre → icono). */
export const BUTTON_ICONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "power", label: "Encendido", icon: Power },
  { value: "play", label: "Iniciar", icon: Play },
  { value: "square", label: "Detener", icon: Square },
  { value: "fan", label: "Ventilador", icon: Fan },
  { value: "snowflake", label: "Frío", icon: Snowflake },
  { value: "flame", label: "Calor", icon: Flame },
  { value: "lightbulb", label: "Luz", icon: Lightbulb },
  { value: "door", label: "Puerta", icon: DoorOpen },
  { value: "droplets", label: "Humedad", icon: Droplets },
  { value: "thermometer", label: "Temperatura", icon: Thermometer },
  { value: "toggle", label: "Interruptor", icon: ToggleLeft },
  { value: "zap", label: "Energía", icon: Zap },
];

/** Resuelve un icono del catálogo por nombre con fallback. */
export function iconByName(name: string, fallback: LucideIcon = Power): LucideIcon {
  return BUTTON_ICONS.find((i) => i.value === name)?.icon ?? fallback;
}

/** Extrae la serie plana de la primera clave del datasource. */
export function firstSeries(
  data: WidgetData,
  keys: string[],
): { points: { ts: number; value: number }[]; key: string } {
  const key = keys[0] ?? "";
  return { key, points: (key && data.series[key]) || [] };
}
