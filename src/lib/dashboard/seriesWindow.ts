/**
 * Ventanas temporales para gráficas, derivadas de los DATOS, no del reloj.
 *
 * Los renderers son funciones puras del render: `Date.now()` cambia entre
 * renders (react-hooks/purity) y haría que el corte de la ventana se moviese
 * de forma impredecible. La serie es un batch reactivo de Convex: usamos el
 * último timestamp observado como "ahora" de la ventana; el corte solo cambia
 * cuando llegan datos nuevos (comportamiento estable entre renders).
 */

import type { DataPoint } from "./datasource";

/**
 * Filtra una serie a la ventana [now - windowMinutes, now] donde `now` es el
 * timestamp del punto más reciente (o 0 si no hay datos).
 */
export function windowedSeries(
  points: DataPoint[] | undefined,
  windowMinutes: number,
): DataPoint[] {
  const arr = points ?? [];
  if (arr.length === 0) return [];
  const now = arr[arr.length - 1].ts;
  const cutoff = now - windowMinutes * 60_000;
  return arr.filter((p) => p.ts >= cutoff);
}

/** Corte (ms) de la ventana calculado sobre el último timestamp observado. */
export function windowCutoff(
  points: DataPoint[] | undefined,
  windowMinutes: number,
): number {
  const arr = points ?? [];
  const now = arr.length > 0 ? arr[arr.length - 1].ts : 0;
  return now - windowMinutes * 60_000;
}

/**
 * Agrega los valores de una serie dentro de la ventana (para KPI).
 * Devuelve undefined si no hay puntos en la ventana.
 */
export function aggregateWindow(
  points: DataPoint[] | undefined,
  windowMinutes: number,
  agg: "last" | "avg" | "min" | "max",
): number | undefined {
  const current = windowedSeries(points, windowMinutes);
  const values = current.map((p) => p.value);
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
