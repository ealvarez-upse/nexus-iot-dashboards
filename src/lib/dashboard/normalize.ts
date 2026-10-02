/**
 * Normalización de dashboards hacia el modelo IMIND v2.
 *
 * Dashboards v1 (legacy): widgets planos
 *   { id, type, title, deviceId, dataKey, unit?, color?, width }
 *
 * Flujo:  Dashboard almacenado → normalizeDashboardDoc() → ImindDashboard v2
 * El builder SIEMPRE trabaja con el modelo normalizado; los dashboards
 * antiguos siguen funcionando sin migración destructiva en la base de datos.
 */

import {
  DASHBOARD_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  newId,
  type Action,
  type Datasource,
  type ImindDashboard,
  type Widget,
  type WidgetPosition,
  type WidgetType,
} from "./model";

/** Widget plano v1 tal como se guardaba en Convex. */
interface LegacyWidgetDoc {
  id: string;
  type: string;
  title: string;
  deviceId?: string;
  dataKey?: string;
  unit?: string;
  color?: string;
  width?: string;
}

interface DashboardDocShape {
  name?: string;
  description?: string;
  widgets?: unknown;
  model?: unknown;
}

/** Mapa de anchos v1 (fracciones) → columnas de la cuadrícula de 12. */
const LEGACY_WIDTH_COLUMNS: Record<string, number> = {
  "1/3": 4,
  "1/2": 6,
  "2/3": 8,
  "1": 12,
};

const LEGACY_DEFAULT_HEIGHT: Record<string, number> = {
  valueCard: 2,
  battery: 2,
  gauge: 3,
  timeSeries: 3,
  alarms: 3,
};

/** Tipos v1 admitidos por el normalizador. */
const LEGACY_TYPES = ["valueCard", "battery", "gauge", "timeSeries", "alarms"];

function mapLegacyType(type: string): WidgetType | undefined {
  switch (type) {
    case "valueCard":
      return "numeric_card";
    case "battery":
      return "numeric_card";
    case "timeSeries":
      return "area_chart";
    case "gauge":
      return "gauge";
    case "alarms":
      return "alarms"; // tipo legacy conservado: el renderer sigue funcionando
    default:
      return undefined;
  }
}

function toInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : NaN;
  return n >= 0 ? n : fallback;
}

/** Convierte un documento almacenado (v1 o v2) al modelo IMIND v2. */
export function normalizeDashboardDoc(doc: DashboardDocShape): ImindDashboard {
  const model = doc.model as ImindDashboard | undefined;
  if (
    model &&
    typeof model === "object" &&
    model.schemaVersion === DASHBOARD_SCHEMA_VERSION &&
    Array.isArray(model.widgets)
  ) {
    return sanitizeModel(model, doc);
  }
  return normalizeLegacy(doc);
}

/** Path v1 → v2: crea datasources a partir de deviceId/dataKey y repone layout. */
function normalizeLegacy(doc: DashboardDocShape): ImindDashboard {
  const legacy = (Array.isArray(doc.widgets) ? doc.widgets : []) as LegacyWidgetDoc[];
  const datasources: Datasource[] = [];
  const widgets: Widget[] = [];

  // Auto-layout secuencial: flujo por filas, sin solapamientos.
  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 1;

  for (const raw of legacy) {
    const type = mapLegacyType(raw.type);
    if (!type || !LEGACY_TYPES.includes(raw.type) || !raw.deviceId) continue;

    const dsId = newId("ds");
    const w = LEGACY_WIDTH_COLUMNS[raw.width ?? "1/2"] ?? 6;
    const h = LEGACY_DEFAULT_HEIGHT[raw.type] ?? 3;

    if (cursorX + w > 12) {
      cursorX = 0;
      cursorY += rowMaxH;
      rowMaxH = 1;
    }
    const position: WidgetPosition = { x: cursorX, y: cursorY, w, h };
    cursorX += w;
    rowMaxH = Math.max(rowMaxH, h);

    if (raw.type === "alarms") {
      datasources.push({
        id: dsId,
        kind: "alarms",
        entityType: "device",
        entityId: raw.deviceId,
        keys: [],
      });
      widgets.push({
        id: raw.id || newId("w"),
        type,
        title: raw.title || "Alarmas activas",
        position,
        datasourceIds: [dsId],
        actionIds: [],
        configuration: {},
      });
      continue;
    }

    datasources.push({
      id: dsId,
      kind: "telemetry",
      entityType: "device",
      entityId: raw.deviceId,
      keys: raw.dataKey ? [raw.dataKey] : [],
    });
    widgets.push({
      id: raw.id || newId("w"),
      type,
      title: raw.title || "Widget",
      position,
      datasourceIds: [dsId],
      actionIds: [],
      configuration: {
        unit: raw.unit ?? "",
        color: raw.color ?? "#0891b2",
        decimals: 2,
        showIcon: true,
        showTitle: true,
        ...(raw.type === "timeSeries" ? { windowMinutes: 1440, showLegend: false } : {}),
        ...(raw.type === "gauge" ? { min: 0, max: 100 } : {}),
      },
    });
  }

  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    metadata: { name: doc.name ?? "Dashboard", description: doc.description },
    settings: { ...DEFAULT_SETTINGS },
    widgets,
    datasources,
    actions: [],
  };
}

/** Reparación defensiva de un modelo v2 almacenado (ids únicos, enteros, refs). */
function sanitizeModel(model: ImindDashboard, doc: DashboardDocShape): ImindDashboard {
  const datasources: Datasource[] = (model.datasources ?? []).filter(
    (ds) => ds && typeof ds.id === "string",
  );
  const actions: Action[] = (model.actions ?? []).filter(
    (a) => a && typeof a.id === "string",
  );
  const dsIds = new Set(datasources.map((d) => d.id));
  const actionIds = new Set(actions.map((a) => a.id));

  const seen = new Set<string>();
  const widgets: Widget[] = (model.widgets ?? [])
    .filter((w) => w && typeof w.id === "string" && typeof w.type === "string")
    .map((w) => {
      let id = w.id;
      while (seen.has(id)) id = newId("w");
      seen.add(id);
      return {
        id,
        type: w.type,
        title: typeof w.title === "string" ? w.title : "Widget",
        position: {
          x: toInt(w.position?.x, 0),
          y: toInt(w.position?.y, 0),
          w: Math.max(1, toInt(w.position?.w, 4)),
          h: Math.max(1, toInt(w.position?.h, 2)),
        },
        datasourceIds: (w.datasourceIds ?? []).filter((d) => dsIds.has(d)),
        actionIds: (w.actionIds ?? []).filter((a) => actionIds.has(a)),
        configuration:
          w.configuration && typeof w.configuration === "object" ? w.configuration : {},
      };
    });

  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    metadata: {
      name: model.metadata?.name ?? doc.name ?? "Dashboard",
      description: model.metadata?.description ?? doc.description,
    },
    settings: {
      columns: model.settings?.columns ?? DEFAULT_SETTINGS.columns,
      rowHeight: model.settings?.rowHeight ?? DEFAULT_SETTINGS.rowHeight,
      margin: model.settings?.margin ?? DEFAULT_SETTINGS.margin,
    },
    widgets,
    datasources,
    actions,
  };
}
