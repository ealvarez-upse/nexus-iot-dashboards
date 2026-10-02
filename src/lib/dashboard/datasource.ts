/**
 * ============================================================
 *  CAPA DE DATASOURCE — abstracción de datos para widgets
 * ============================================================
 *
 * Flujo:  Widget → useWidgetData(ds) → Provider → Convex
 *
 * Los widgets/renderers NUNCA importan Convex: solo conocen `WidgetData`.
 * Hoy el provider es Convex (telemetría real + demo). En el futuro se
 * agregarán providers MQTT / HTTP / Simulado / ThingsBoard resolviendo
 * por `ds.kind`, sin tocar los renderers.
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Datasource } from "./model";

export interface DataPoint {
  ts: number;
  value: number;
}

export interface AlarmSummary {
  _id: string;
  dataKey: string;
  type: "max" | "min";
  threshold: number;
  value: number;
  severity: "critical" | "warning";
  startTs: number;
}

export interface DeviceSummary {
  _id: string;
  name: string;
  label?: string;
  lastSeenAt?: number;
  battery?: number;
  /** Umbrales de alarma del dispositivo (para líneas de límite en gráficas). */
  thresholds?: Partial<Record<string, { min?: number; max?: number }>>;
}

/** Lo único que un renderer necesita saber de los datos. */
export interface WidgetData {
  loading: boolean;
  series: Record<string, DataPoint[]>;
  latest: Record<string, number | undefined>;
  alarms: AlarmSummary[];
  device?: DeviceSummary;
  error?: string;
}

export const EMPTY_WIDGET_DATA: WidgetData = {
  loading: false,
  series: {},
  latest: {},
  alarms: [],
};

/**
 * Un Provider resuelve kinds de datasource concretos. La implementación con
 * hooks debe llamarlos SIEMPRE en el mismo orden (usar "skip" de Convex).
 */
export interface DatasourceProvider {
  id: string;
  kinds: string[];
  useData: (ds: Datasource | undefined, pointLimit?: number) => WidgetData;
}

/** Último valor de cada serie. */
function mapLatest(series: Record<string, DataPoint[]> | undefined): Record<string, number | undefined> {
  const latest: Record<string, number | undefined> = {};
  if (!series) return latest;
  for (const key of Object.keys(series)) {
    const arr = series[key];
    latest[key] = arr && arr.length > 0 ? arr[arr.length - 1].value : undefined;
  }
  return latest;
}

/**
 * PROVIDER CONVEX — único transporte implementado en Fase 1.
 * kind "telemetry": series temporales por clave.
 * kind "alarms": alarmas activas de un dispositivo (widget legacy).
 */
const ConvexDatasourceProvider: DatasourceProvider = {
  id: "convex",
  kinds: ["telemetry", "alarms"],
  useData: (ds, pointLimit = 1440): WidgetData => {
    const deviceId = (ds?.entityId ?? "") as never;
    const keys = ds?.keys ?? [];
    const hasDevice = typeof ds?.entityId === "string" && ds.entityId.length > 0;
    const wantsAlarms = ds?.kind === "alarms";

    const series = useQuery(
      api.devices.latestSeries,
      hasDevice && keys.length > 0 ? { deviceId, keys, limit: pointLimit } : "skip",
    ) as Record<string, DataPoint[]> | undefined;

    const device = useQuery(
      api.devices.get,
      hasDevice ? { id: deviceId } : "skip",
    ) as DeviceSummary | undefined;

    const alarms = useQuery(
      api.alarms.list,
      wantsAlarms && hasDevice ? { deviceId, status: "active", limit: 8 } : "skip",
    ) as AlarmSummary[] | undefined;

    if (!ds) return EMPTY_WIDGET_DATA;

    const loading =
      (keys.length > 0 && series === undefined) || (wantsAlarms && alarms === undefined);

    return {
      loading,
      series: series ?? {},
      latest: mapLatest(series),
      alarms: alarms ?? [],
      device,
    };
  },
};

const PROVIDERS: DatasourceProvider[] = [ConvexDatasourceProvider];

export function getProviderFor(kind: string): DatasourceProvider | undefined {
  return PROVIDERS.find((p) => p.kinds.includes(kind));
}

/**
 * Punto ÚNICO de acceso a datos de un widget. Cambiar el transporte de datos
 * (Convex → MQTT/HTTP) significa agregar un provider aquí, no tocar widgets.
 *
 * Nota de arquitectura: mientras exista un solo provider, se invoca sus hooks
 * de forma incondicional (reglas de React). Con varios providers, resolver con
 * subcomponentes por provider en lugar de condicionales.
 */
export function useWidgetData(ds: Datasource | undefined, pointLimit?: number): WidgetData {
  const data = ConvexDatasourceProvider.useData(ds, pointLimit);
  if (ds && !getProviderFor(ds.kind)) {
    return { ...EMPTY_WIDGET_DATA, error: `Datasource no soportado: ${ds.kind}` };
  }
  return data;
}
