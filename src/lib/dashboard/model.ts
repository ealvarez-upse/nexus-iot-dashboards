/**
 * ============================================================
 *  MODELO INTERNO IMIND DE DASHBOARDS — versión 2
 * ============================================================
 *
 * Este modelo es la FUENTE DE VERDAD del Dashboard Builder.
 *
 * Reglas de arquitectura:
 *  - 100 % independiente de ThingsBoard (el futuro importador JSON será un
 *    adaptador en `src/lib/integrations/thingsboard/` que convierta
 *    ThingsBoard JSON → ImindDashboard; nada de este modelo depende de él).
 *  - 100 % serializable a JSON (sin clases, funciones ni referencias a DOM)
 *    para soportar Export/Import IMIND JSON, plantillas y duplicado.
 *  - Separa explícitamente: Dashboard / Widget / Datasource / Action / Layout.
 *  - El layout es LÓGICO (x, y, w, h en unidades de cuadrícula); el motor de
 *    layout convierte a píxeles. El tamaño físico nunca vive en el modelo.
 *  - Los datasources y las acciones viven a nivel de documento; los widgets
 *    los referencian por id (permite compartirlos y mapearlos en el futuro).
 */

export const DASHBOARD_SCHEMA_VERSION = 2;

/** Entidades sobre las que puede leerse datos o ejecutarse acciones. */
export type EntityType = "device";

/** Cómo se resuelven los datos del widget. Hoy: Convex. Mañana: MQTT/HTTP/etc. */
export type DatasourceKind = "telemetry" | "alarms";

/**
 * Datasource declarativo: QUÉ datos pide un widget, no DE DÓNDE vienen.
 * El widget nunca habla con Convex/MQTT/HTTP directamente: siempre a través
 * de `useWidgetData(ds)` → Provider.
 */
export interface Datasource {
  id: string;
  kind: DatasourceKind;
  entityType: EntityType;
  entityId: string;
  keys: string[];
  /** Segundos. Informativo hoy (Convex es push-reactivo); MQTT/HTTP lo usarán. */
  refreshInterval?: number;
  configuration?: Record<string, unknown>;
}

export type ActionTrigger = "on_click" | "on_change";
export type ActionType = "send_command";

export interface ActionTarget {
  entityType: EntityType;
  entityId: string;
}

/** Acción independiente del transporte: la ejecuta el ActionExecutor/Provider. */
export interface Action {
  id: string;
  trigger: ActionTrigger;
  type: ActionType;
  target?: ActionTarget;
  payload?: Record<string, unknown>;
}

/** Posición/tamaño en unidades LÓGICAS de cuadrícula (12 columnas). */
export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type WidgetType =
  // Indicadores
  | "numeric_card"
  | "status_card"
  | "kpi"
  // Gráficos
  | "line_chart"
  | "area_chart"
  // Gauges
  | "gauge"
  // Control
  | "button"
  | "switch"
  // Tablas
  | "data_table"
  // Avanzado (estructura preparada; render seguro en iframe sandbox)
  | "html_card"
  // Legacy v1: lista de alarmas activas (solo lectura de dashboards migrados)
  | "alarms";

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  datasourceIds: string[];
  actionIds: string[];
  /** Configuración específica del tipo (validada por el registry). */
  configuration: Record<string, unknown>;
}

export interface DashboardSettings {
  /** Columnas de la cuadrícula (12 confirmado). */
  columns: number;
  /** Altura de fila en px: solo referencia del motor; el modelo es lógico. */
  rowHeight: number;
  /** Separación en px entre widgets. */
  margin: number;
}

/**
 * Dashboard como DOCUMENTO serializable:
 * Metadata + Settings + Widgets + Datasources + Actions.
 */
export interface ImindDashboard {
  schemaVersion: number;
  metadata: { name: string; description?: string };
  settings: DashboardSettings;
  widgets: Widget[];
  datasources: Datasource[];
  actions: Action[];
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  columns: 12,
  rowHeight: 80,
  margin: 12,
};

/** Id corto con prefijo, suficiente para documentos locales (no es crypto). */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Clon profundo serializable (compatible con el target TS del proyecto). */
export function cloneModel<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createEmptyDashboard(name: string, description?: string): ImindDashboard {
  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    metadata: { name, description },
    settings: { ...DEFAULT_SETTINGS },
    widgets: [],
    datasources: [],
    actions: [],
  };
}

/** Datasource primario de un widget (primero de la lista). */
export function primaryDatasource(
  dashboard: ImindDashboard,
  widget: Widget,
): Datasource | undefined {
  const id = widget.datasourceIds[0];
  if (!id) return undefined;
  return dashboard.datasources.find((ds) => ds.id === id);
}
