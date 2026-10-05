/**
 * ============================================================
 *  PRUEBAS DEL GAUGE — Fase 2.1 (bun test)
 * ============================================================
 * Regresión del bug "Gauge muestra —": el renderer llamaba
 * firstSeries(data, []) → key "" → data.latest[""] → undefined,
 * aunque el datasource tuviera datos reales.
 *
 * Cubre los 5 casos exigidos:
 *   1. Gauge + temperature numérico renderiza el valor.
 *   2. Gauge + humidity numérico renderiza el valor.
 *   3. Gauge + valor 0 renderiza 0 y NO "—" (0 es un valor válido).
 *   4. Gauge + undefined/ausencia muestra el fallback "—".
 *   5. El Gauge usa la MISMA fuente autorizada que Numeric Card
 *      (WidgetData de useWidgetData vía WidgetFrame).
 * Más guard-rails de fuente sobre los renderers corregidos.
 *
 * Ejecutar:  bun test src/lib/dashboard/__tests__/gauge.test.ts
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  firstSeries,
  formatValue,
  latestValueOf,
  seriesKeys,
} from "../../../components/widgets/renderers/widget-utils";
import type { WidgetData } from "../datasource";

const REPO_ROOT = process.cwd();
function src(rel: string): string {
  return readFileSync(`${REPO_ROOT}/${rel}`, "utf8");
}

/** WidgetData mínimo según el contrato de useWidgetData. */
function wd(partial: Partial<WidgetData>): WidgetData {
  return { loading: false, series: {}, latest: {}, alarms: [], ...partial };
}

/** Datos representativos del sensor demo (Sensor BLE Demo · JW1407HT). */
const temperatureData = wd({
  series: {
    temperature: [
      { ts: 1, value: 4.2 },
      { ts: 2, value: 5.65 },
    ],
  },
  latest: { temperature: 5.65 },
});

const humidityData = wd({
  series: {
    humidity: [
      { ts: 1, value: 58.1 },
      { ts: 2, value: 61.3 },
    ],
  },
  latest: { humidity: 61.3 },
});

const zeroData = wd({
  series: {
    temperature: [
      { ts: 1, value: 7.1 },
      { ts: 2, value: 0 },
    ],
  },
  latest: { temperature: 0 },
});

const emptyData = wd({});

/* ------------------------------------------------------------------ */
/* 1–4 · Resolución de valor del Gauge                                 */
/* ------------------------------------------------------------------ */

describe("Gauge · resolución de valor (regresión '—', Fase 2.1)", () => {
  it("Caso 1 · Gauge + temperature numérico renderiza el valor", () => {
    const { key, value } = latestValueOf(temperatureData);
    expect(key).toBe("temperature");
    expect(value).toBe(5.65);
    expect(formatValue(value, 1, "°C")).toBe("5,7 °C");
  });

  it("Caso 2 · Gauge + humidity numérico renderiza el valor", () => {
    const { key, value } = latestValueOf(humidityData);
    expect(key).toBe("humidity");
    expect(value).toBe(61.3);
    expect(formatValue(value, 2, "%")).toBe("61,3 %");
  });

  it("Caso 3 · Gauge + valor 0 renderiza 0 y NO '—' (0 es válido)", () => {
    const { value } = latestValueOf(zeroData);
    expect(value).toBe(0);
    expect(value).not.toBe(7.1); // es el ÚLTIMO punto, no el máximo
    expect(formatValue(value, 1, "°C")).toBe("0 °C");
    expect(formatValue(value, 1, "°C")).not.toBe("—");
  });

  it("Caso 4 · Gauge sin datos muestra el fallback '—'", () => {
    // Sin series (p. ej. datasource sin keys o aún cargando): ausencia real.
    expect(latestValueOf(emptyData)).toEqual({ key: "", value: undefined });
    // Serie presente pero vacía → `latest` tampoco tiene valor.
    const emptySeries = wd({
      series: { temperature: [] },
      latest: { temperature: undefined },
    });
    expect(latestValueOf(emptySeries).value).toBeUndefined();
    expect(formatValue(undefined, 1, "°C")).toBe("—");
    expect(formatValue(NaN, 1, "°C")).toBe("—");
    // Nota: el contrato WidgetData solo admite number | undefined (la
    // telemetría de Convex es v.number()), por lo que null no llega al
    // renderer; la ausencia se representa siempre como undefined.
  });

  it("Caso 5 · el Gauge usa la MISMA fuente autorizada que Numeric Card", () => {
    // Réplica exacta del algoritmo de numeric_card.tsx (el widget que sí
    // muestra 61,3 % en el dashboard real con el mismo datasource).
    function numericCardResolution(
      data: WidgetData,
    ): { key: string; value: number | undefined } {
      const keys =
        data.series && Object.keys(data.series).length > 0
          ? Object.keys(data.series)
          : [];
      const { key, points } = firstSeries(data, keys.length > 0 ? keys : []);
      const value =
        points.length > 0 ? points[points.length - 1].value : data.latest[key];
      return { key, value };
    }

    for (const data of [temperatureData, humidityData, zeroData, emptyData]) {
      expect(latestValueOf(data)).toEqual(numericCardResolution(data));
    }
    expect(seriesKeys(humidityData)).toEqual(["humidity"]);
  });
});

/* ------------------------------------------------------------------ */
/* Guard-rails de fuente (arquitectura)                                */
/* ------------------------------------------------------------------ */

describe("Gauge · guard-rails de fuente (Fase 2.1)", () => {
  it("gauge.tsx resuelve con latestValueOf y ya no pasa keys vacías", () => {
    const g = src("src/components/widgets/renderers/gauge.tsx");
    expect(g.includes("latestValueOf(data)")).toBe(true);
    expect(g.includes("firstSeries(data, [])")).toBe(false);
  });

  it("kpi.tsx y status_card.tsx derivan las claves de data.series (mismo bug corregido)", () => {
    expect(
      src("src/components/widgets/renderers/kpi.tsx").includes(
        "firstSeries(data, seriesKeys(data))",
      ),
    ).toBe(true);
    expect(
      src("src/components/widgets/renderers/status_card.tsx").includes(
        "latestValueOf(data)",
      ),
    ).toBe(true);
    // ninguno conserva el patrón roto que producía "—"
    for (const f of [
      "gauge.tsx",
      "kpi.tsx",
      "status_card.tsx",
      "numeric_card.tsx",
    ]) {
      expect(
        src(`src/components/widgets/renderers/${f}`).includes(
          "firstSeries(data, [])",
        ),
      ).toBe(false);
    }
  });

  it("el Gauge no accede a fuentes fuera del contrato autorizado", () => {
    const g = src("src/components/widgets/renderers/gauge.tsx");
    expect(g.includes("convex")).toBe(false);
    expect(g.includes("useWidgetData")).toBe(false);
    expect(g.includes("fetch(")).toBe(false);
    // El único punto de acceso a datos sigue siendo WidgetFrame → useWidgetData.
    expect(
      src("src/components/dashboard/WidgetFrame.tsx").includes(
        "useWidgetData(datasource)",
      ),
    ).toBe(true);
    expect(
      src("src/lib/dashboard/datasource.ts").includes("api.devices.latestSeries"),
    ).toBe(true);
  });
});
