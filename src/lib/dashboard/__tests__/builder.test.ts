/**
 * ============================================================
 *  PRUEBAS DEL DASHBOARD BUILDER — Fase 1.1 (bun test)
 * ============================================================
 * Cubre: migración legacy→v2, sanitizado v2, layout, ventanas de
 * series, operaciones del builder (duplicar/eliminar), semántica
 * de borrador/guardado, integridad del registry y guard-rails de
 * arquitectura (separación de datasource, pureza de renderers,
 * HTML Card aislado, guards de sesión en el backend).
 *
 * Ejecutar:  bun test src/lib/dashboard/__tests__/builder.test.ts
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { normalizeDashboardDoc } from "../normalize";
import {
  clampMove,
  clampResize,
  computeMetrics,
  findFreePosition,
  pxH,
  pxW,
  pxX,
  pxY,
} from "../layout";
import {
  aggregateWindow,
  windowCutoff,
  windowedSeries,
} from "../seriesWindow";
import {
  DEFAULT_SETTINGS,
  cloneModel,
  createEmptyDashboard,
  newId,
  type ImindDashboard,
  type WidgetType,
} from "../model";
import {
  duplicateWidget,
  removeWidget,
  stripOrphans,
} from "../ops";
import {
  configWithDefaults,
  getWidgetDefinition,
  libraryTypes,
  WIDGET_REGISTRY,
} from "../registry";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const REPO_ROOT = process.cwd();
function src(rel: string): string {
  return readFileSync(`${REPO_ROOT}/${rel}`, "utf8");
}

function legacyDoc() {
  return {
    name: "HVAC Planta 1",
    description: "Cadena de frío",
    widgets: [
      { id: "a1", type: "valueCard", title: "Temp sala", deviceId: "dev1", dataKey: "temperature", unit: "°C", width: "1/3" },
      { id: "a2", type: "battery", title: "Batería", deviceId: "dev1", dataKey: "battery", width: "1/3" },
      { id: "a3", type: "timeSeries", title: "Histórico", deviceId: "dev1", dataKey: "temperature", width: "2/3" },
      { id: "a4", type: "gauge", title: "Gauge humedad", deviceId: "dev2", dataKey: "humidity", width: "1/3" },
      { id: "a5", type: "alarms", title: "Alarmas", deviceId: "dev2", width: "1/2" },
      { id: "a6", type: "desconocido", title: "No soportado", deviceId: "dev1", dataKey: "x", width: "1" },
      { id: "a7", type: "valueCard", title: "Sin dispositivo", dataKey: "temperature" },
    ],
  };
}

/** Simula el flujo de DashboardViewPage.addWidget (biblioteca → canvas). */
function addWidget(model: ImindDashboard, type: WidgetType) {
  const def = getWidgetDefinition(type);
  const next = cloneModel(model);
  const pos = findFreePosition(next.widgets, def.defaultSize.w, def.defaultSize.h, next.settings.columns);
  const widget = {
    id: newId("w"),
    type,
    title: def.label,
    position: pos,
    datasourceIds: [],
    actionIds: [],
    configuration: { ...def.defaults },
  };
  next.widgets.push(widget);
  return { next, widgetId: widget.id };
}

function withButtonAction(model: ImindDashboard, widgetId: string): ImindDashboard {
  const next = cloneModel(model);
  const w = next.widgets.find((x) => x.id === widgetId)!;
  const action = {
    id: newId("act"),
    trigger: "on_click" as const,
    type: "send_command" as const,
    target: { entityType: "device" as const, entityId: "dev1" },
    payload: { command: "ON" },
  };
  next.actions.push(action);
  w.actionIds = [action.id];
  return next;
}

/* ------------------------------------------------------------------ */
/* 1 · Migración legacy → v2 (no destructiva)                          */
/* ------------------------------------------------------------------ */

describe("migración legacy → v2", () => {
  const migrated = normalizeDashboardDoc(legacyDoc());

  it("produce modelo v2 con metadata y settings por defecto", () => {
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.metadata.name).toBe("HVAC Planta 1");
    expect(migrated.settings.columns).toBe(DEFAULT_SETTINGS.columns);
  });

  it("mapea tipos v1 y descarta lo desconocido (5 de 7)", () => {
    expect(migrated.widgets.map((w) => w.type)).toEqual([
      "numeric_card",
      "numeric_card",
      "area_chart",
      "gauge",
      "alarms",
    ]);
  });

  it("convierte anchos fraccionarios a 12 columnas sin solapes", () => {
    expect(migrated.widgets[0]?.position.w).toBe(4);
    expect(migrated.widgets[2]?.position.w).toBe(8);
    expect(migrated.widgets[0]?.position.x).toBe(0);
    expect(migrated.widgets[1]?.position.x).toBe(4);
    expect(migrated.widgets[2]?.position.y).toBeGreaterThan(0);
  });

  it("crea un datasource por widget y deja las acciones vacías", () => {
    expect(migrated.datasources).toHaveLength(5);
    expect(migrated.datasources[0]?.keys).toEqual(["temperature"]);
    expect(migrated.datasources[4]?.kind).toBe("alarms");
    expect(migrated.widgets[0]?.datasourceIds[0]).toBe(migrated.datasources[0]?.id);
    expect(migrated.actions).toHaveLength(0);
  });

  it("los documentos v2 existentes se conservan sin pérdida", () => {
    const model = createEmptyDashboard("Panel", "desc");
    model.widgets.push({
      id: "w1",
      type: "gauge",
      title: "G",
      position: { x: 0, y: 0, w: 4, h: 3 },
      datasourceIds: ["ds1"],
      actionIds: [],
      configuration: { min: 0, max: 20 },
    });
    const out = normalizeDashboardDoc({ name: "Panel", model });
    expect(out.widgets).toHaveLength(1);
    expect(out.widgets[0]?.configuration).toEqual({ min: 0, max: 20 });
    expect(out.datasources).toHaveLength(0); // ds1 no existe → ref saneada
    expect(out.widgets[0]?.datasourceIds).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* 2 · Layout lógico de 12 columnas                                    */
/* ------------------------------------------------------------------ */

describe("layout lógico → px", () => {
  const m = computeMetrics(1200, DEFAULT_SETTINGS);

  it("calcula métricas y conversiones", () => {
    expect(m.colWidth).toBeCloseTo((1200 - 11 * 12) / 12, 9);
    expect(pxX(6, m)).toBeCloseTo(6 * (m.colWidth + 12), 9);
    expect(pxW(3, m)).toBeCloseTo(3 * m.colWidth + 2 * 12, 9);
    expect(pxY(1, m)).toBe(92);
    expect(pxH(2, m)).toBe(172);
  });

  it("clampMove y clampResize respetan límites y mínimos", () => {
    expect(clampMove({ x: 10, y: 0, w: 4, h: 2 }, 5, -3, 12)).toMatchObject({ x: 8, y: 0 });
    expect(clampResize({ x: 0, y: 0, w: 3, h: 2 }, -5, -5, { w: 3, h: 2 }, 12)).toMatchObject({ w: 3, h: 2 });
    expect(clampResize({ x: 9, y: 0, w: 3, h: 2 }, 5, 0, { w: 2, h: 2 }, 12)).toMatchObject({ w: 3 });
  });

  it("findFreePosition no solapa y cae a x=0 si w>columnas", () => {
    expect(findFreePosition([], 4, 2, 12)).toEqual({ x: 0, y: 0, w: 4, h: 2 });
    const dash = createEmptyDashboard("t");
    dash.widgets.push({
      id: "w1",
      type: "numeric_card",
      title: "t",
      position: { x: 0, y: 0, w: 12, h: 2 },
      datasourceIds: [],
      actionIds: [],
      configuration: {},
    });
    expect(findFreePosition(dash.widgets, 4, 2, 12)).toMatchObject({ x: 0, y: 2 });
    expect(findFreePosition(dash.widgets, 13, 2, 12).x).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 3 · Ventanas de series (pureza: sin Date.now en render)             */
/* ------------------------------------------------------------------ */

describe("seriesWindow (cutoff data-driven)", () => {
  const now = 1_000_000;
  const pts = [
    { ts: now - 3 * 60_000, value: 1 },
    { ts: now - 90 * 60_000, value: 2 },
    { ts: now - 90 * 60_000 + 1, value: 3 },
    { ts: now, value: 4 },
  ];

  it("windowedSeries recorta por el último timestamp observado", () => {
    expect(windowedSeries(pts, 60)).toHaveLength(2);
    expect(windowedSeries([], 60)).toHaveLength(0);
    expect(windowedSeries(undefined, 60)).toHaveLength(0);
  });

  it("windowCutoff es determinista con los mismos datos", () => {
    expect(windowCutoff(pts, 60)).toBe(now - 60 * 60_000);
    expect(windowCutoff(pts, 60)).toBe(windowCutoff(pts, 60));
  });

  it("aggregateWindow agrega last/avg/min/max", () => {
    // ventana [now−60min, now] sobre pts → valores [1, 4]
    expect(aggregateWindow(pts, 60, "last")).toBe(4);
    expect(aggregateWindow(pts, 60, "avg")).toBe(2.5);
    expect(aggregateWindow(pts, 60, "min")).toBe(1);
    expect(aggregateWindow(pts, 60, "max")).toBe(4);
    expect(aggregateWindow([], 60, "avg")).toBeUndefined();
  });

  it("los renderers de gráficas no llaman Date.now() durante el render", () => {
    for (const f of ["area_chart.tsx", "line_chart.tsx", "kpi.tsx"]) {
      expect(src(`src/components/widgets/renderers/${f}`).includes("Date.now()")).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 4 · Operaciones del builder (duplicar / eliminar / huérfanos)       */
/* ------------------------------------------------------------------ */

describe("ops del builder", () => {
  function baseModel(): ImindDashboard {
    const { next, widgetId } = addWidget(createEmptyDashboard("m"), "button");
    return withButtonAction(next, widgetId);
  }

  it("duplicar un botón genera una acción INDEPENDIENTE", () => {
    const model = baseModel();
    const original = model.widgets[0];
    const res = duplicateWidget(model, original.id);
    expect(res.newWidgetId).not.toBeNull();
    const copy = res.model.widgets.find((w) => w.id === res.newWidgetId)!;
    // misma config/tipo/destino/payload...
    expect(copy.type).toBe(original.type);
    expect(copy.title).toBe(`${original.title} (copia)`);
    expect(copy.actionIds).toHaveLength(1);
    // ...pero NUEVA id de acción, con parámetros conservados
    const originalAction = model.actions.find((a) => a.id === original.actionIds[0])!;
    const copyAction = res.model.actions.find((a) => a.id === copy.actionIds[0])!;
    expect(copyAction.id).not.toBe(originalAction.id);
    expect(copyAction.trigger).toBe(originalAction.trigger);
    expect(copyAction.type).toBe(originalAction.type);
    expect(copyAction.target).toEqual(originalAction.target);
    expect(copyAction.payload).toEqual(originalAction.payload);
  });

  it("modificar la acción de la copia NO afecta al original", () => {
    const model = baseModel();
    const original = model.widgets[0];
    const res = duplicateWidget(model, original.id);
    const copy = res.model.widgets.find((w) => w.id === res.newWidgetId)!;
    // edición de la copia: cambiar payload y target
    const edited = cloneModel(res.model);
    const copyAction = edited.actions.find((a) => a.id === copy.actionIds[0])!;
    copyAction.payload = { command: "OFF" };
    copyAction.target = { entityType: "device", entityId: "dev-otro" };
    const originalActionAfter = edited.actions.find((a) => a.id === original.actionIds[0])!;
    expect(originalActionAfter.payload).toEqual({ command: "ON" });
    expect(originalActionAfter.target).toEqual({ entityType: "device", entityId: "dev1" });
    expect(res.model.actions.find((a) => a.id === original.actionIds[0])?.payload).toEqual({ command: "ON" });
  });

  it("las acciones COMPARTIDAS con otros widgets no se clonan (se re-referencian)", () => {
    const model = baseModel();
    const original = model.widgets[0];
    // un segundo widget referencia la MISMA acción
    const shared = cloneModel(model);
    shared.widgets.push({ ...cloneModel(original), id: "w-otro", title: "Otro" });
    const res = duplicateWidget(shared, original.id);
    const copy = res.model.widgets.find((w) => w.id === res.newWidgetId)!;
    expect(copy.actionIds[0]).toBe(original.actionIds[0]); // misma acción compartida
    expect(res.model.actions).toHaveLength(shared.actions.length); // sin clones extra
  });

  it("eliminar un widget limpia solo lo huérfano", () => {
    const model = baseModel();
    const res = duplicateWidget(model, model.widgets[0].id);
    const withDs = cloneModel(res.model);
    withDs.datasources.push({ id: "ds1", kind: "telemetry", entityType: "device", entityId: "dev1", keys: ["temperature"] });
    withDs.widgets[0]!.datasourceIds = ["ds1"];
    const afterRemove = removeWidget(withDs, withDs.widgets[1]!.id);
    expect(afterRemove.widgets).toHaveLength(1);
    expect(afterRemove.actions).toHaveLength(1); // la acción del original sigue
    expect(afterRemove.datasources).toHaveLength(1); // ds del original sigue
    const final = removeWidget(afterRemove, afterRemove.widgets[0]!.id);
    expect(final.actions).toHaveLength(0);
    expect(final.datasources).toHaveLength(0);
  });

  it("stripOrphans elimina exactamente lo no referenciado", () => {
    const model = baseModel();
    model.datasources.push({ id: "ds-huerfano", kind: "telemetry", entityType: "device", entityId: "dev1", keys: [] });
    const out = stripOrphans(model);
    expect(out.datasources).toHaveLength(0);
    expect(out.actions).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* 5 · Borrador local / guardar / cancelar                             */
/* ------------------------------------------------------------------ */

describe("borrador local, guardar y cancelar", () => {
  it("entrar a edición clona (el almacenado queda intacto al cancelar)", () => {
    const stored = normalizeDashboardDoc(legacyDoc());
    const snapshot = JSON.stringify(stored);
    const draft = cloneModel(stored);
    const { next } = addWidget(draft, "numeric_card");
    expect(next.widgets).toHaveLength(stored.widgets.length + 1);
    // CANCELAR: se descarta el draft; el documento almacenado no cambió
    expect(JSON.stringify(stored)).toBe(snapshot);
  });

  it("guardar persiste el modelo v2 serializable y sobrevive a la recarga", () => {
    const stored = normalizeDashboardDoc(legacyDoc());
    const draft = cloneModel(stored);
    const { next, widgetId } = addWidget(draft, "button");
    const withAction = withButtonAction(next, widgetId);
    // GUARDAR = api.dashboards.save({ model: draft })
    const payload = JSON.parse(JSON.stringify({ ...withAction, metadata: { name: "HVAC Planta 1" } }));
    expect(payload.schemaVersion).toBe(2);
    const reloaded = normalizeDashboardDoc({ name: "HVAC Planta 1", model: payload });
    expect(reloaded.widgets.map((w) => w.id).sort()).toEqual(withAction.widgets.map((w) => w.id).sort());
    expect(reloaded.datasources).toHaveLength(withAction.datasources.length);
    expect(reloaded.actions).toHaveLength(withAction.actions.length);
  });
});

/* ------------------------------------------------------------------ */
/* 6 · Registry (11 tipos) y HTML Card aislado                         */
/* ------------------------------------------------------------------ */

describe("registry e integridad", () => {
  it("registra 11 tipos y la biblioteca excluye el legacy", () => {
    expect(Object.keys(WIDGET_REGISTRY)).toHaveLength(11);
    expect(libraryTypes()).toHaveLength(10);
    expect(libraryTypes().includes("alarms" as WidgetType)).toBe(false);
  });

  it("todas las definiciones están completas y configWithDefaults fusiona", () => {
    for (const def of Object.values(WIDGET_REGISTRY)) {
      expect(def.icon).toBeDefined();
      expect(def.Renderer).toBeDefined();
      const keys = new Set(def.configSchema.map((f) => f.key));
      expect(keys.size).toBe(def.configSchema.length);
      for (const f of def.configSchema) {
        if (f.type === "select") expect(f.options?.length ?? 0).toBeGreaterThan(0);
      }
    }
    expect(configWithDefaults("numeric_card", { unit: "K" }).unit).toBe("K");
    expect(configWithDefaults("numeric_card", {}).decimals).toBe(2);
    expect(getWidgetDefinition("no_existe").label).toBe("no_existe");
  });
});

describe("guard-rails de arquitectura", () => {
  it("ningún renderer importa Convex ni llama useQuery/useMutation", () => {
    const files = [
      "numeric_card.tsx", "status_card.tsx", "kpi.tsx", "line_chart.tsx",
      "area_chart.tsx", "gauge.tsx", "button.tsx", "switch.tsx",
      "data_table.tsx", "html_card.tsx", "alarms.tsx", "unknown.tsx",
      "shared.tsx", "widget-utils.ts", "use-widget-action.ts",
    ];
    for (const f of files) {
      const content = src(`src/components/widgets/renderers/${f}`);
      expect(content.includes("convex")).toBe(false);
      expect(content.includes("useQuery")).toBe(false);
      expect(content.includes("useMutation")).toBe(false);
    }
  });

  it("useWidgetData es el único punto de acceso (solo WidgetFrame lo consume)", () => {
    expect(src("src/components/dashboard/WidgetFrame.tsx").includes("useWidgetData(")).toBe(true);
    expect(src("src/lib/dashboard/datasource.ts").includes("api.devices.latestSeries")).toBe(true);
    expect(src("src/lib/dashboard/datasource.ts").includes("api.alarms.list")).toBe(true);
  });

  it("HTML Card: iframe sandbox EXACTAMENTE allow-scripts (Fase 2)", () => {
    const content = src("src/components/widgets/renderers/html_card.tsx");
    // Fase 2: el JS del usuario se ejecuta en el sandbox → allow-scripts es
    // obligatorio, pero el atributo debe ser EXACTO: sin allow-same-origin
    // (origen opaco), sin top-navigation, popups, forms ni modals.
    expect(content.includes('sandbox={SANDBOX_ATTR}')).toBe(true);
    const srcdoc = src("src/lib/dashboard/htmlcard/srcdoc.ts");
    expect(srcdoc.includes('SANDBOX_ATTR = "allow-scripts"')).toBe(true);
    // el srcDoc del renderer y del editor viene SIEMPRE de buildSandboxDoc
    expect(content.includes("buildSandboxDoc(")).toBe(true);
    expect(src("src/components/dashboard/HtmlCardConfigDialog.tsx").includes("buildSandboxDoc(")).toBe(true);
    // el código del usuario nunca se inyecta en el DOM principal
    expect(content.includes("dangerouslySetInnerHTML")).toBe(false);
  });

  it("el backend exige sesión en las lecturas del dashboard builder", () => {
    const dash = src("src/convex/dashboards.ts");
    const dev = src("src/convex/devices.ts");
    for (const fn of ["export const list", "export const get", "export const save", "export const remove"]) {
      expect(dash.includes(fn)).toBe(true);
    }
    // guards explícitos en las consultas que alimenta useWidgetData
    expect(dev.includes("No autenticado")).toBe(true);
    expect(dev.includes("Sin permisos para leer este dispositivo")).toBe(true);
    expect(src("src/convex/dashboards.ts").includes("Sin permisos para ver este dashboard")).toBe(true);
    expect(src("src/convex/commands.ts").includes("Sin permisos para enviar comandos")).toBe(true);
  });
});
