/**
 * ============================================================
 *  REGISTRY DE WIDGETS — fuente central del Dashboard Builder
 * ============================================================
 *
 * Cada tipo de widget define: label, categoría, icono, tamaños (default/min),
 * cómo pide claves al datasource, slots de acción, schema de configuración y
 * Renderer. AGREGAR UN WIDGET NUEVO = crear renderer + registrar entrada aquí.
 * El núcleo del builder (canvas, drag/resize, guardado) no se modifica.
 *
 * `configSchema` alimenta el formulario genérico del diálogo de configuración
 * (cada tipo define sus propios campos; no hay un formulario rígido único).
 */

import {
  Activity,
  AlignLeft,
  Code2,
  Gauge as GaugeIcon,
  LineChart as LineChartIcon,
  MousePointerClick,
  Route,
  Table2,
  Thermometer,
  ToggleLeft,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { WidgetType } from "./model";
import { newId } from "./model";
import type {
  ConfigField,
  WidgetCategory,
  WidgetDefinition,
  WidgetSize,
} from "./widget-def";
import { NumericCardRenderer } from "@/components/widgets/renderers/numeric_card";
import { StatusCardRenderer } from "@/components/widgets/renderers/status_card";
import { KpiRenderer } from "@/components/widgets/renderers/kpi";
import { LineChartRenderer } from "@/components/widgets/renderers/line_chart";
import { AreaChartRenderer } from "@/components/widgets/renderers/area_chart";
import { GaugeRenderer } from "@/components/widgets/renderers/gauge";
import { BUTTON_ICONS, ButtonRenderer } from "@/components/widgets/renderers/button";
import { SwitchRenderer } from "@/components/widgets/renderers/switch";
import { DataTableRenderer } from "@/components/widgets/renderers/data_table";
import { HtmlCardRenderer } from "@/components/widgets/renderers/html_card";
import { LegacyAlarmsRenderer } from "@/components/widgets/renderers/alarms";

export const PALETTE = [
  "#0891b2", "#0d9488", "#ca8a04", "#dc2626", "#7c3aed", "#2563eb", "#16a34a",
];

export const WIDGET_CATEGORY_LABEL: Record<WidgetCategory, string> = {
  indicadores: "Indicadores",
  graficos: "Gráficos",
  gauges: "Gauges",
  control: "Control",
  tablas: "Tablas",
  avanzado: "Avanzado",
  legacy: "Legacy",
};

/** Orden de categorías en la biblioteca. */
export const WIDGET_CATEGORY_ORDER: WidgetCategory[] = [
  "indicadores",
  "graficos",
  "gauges",
  "control",
  "tablas",
  "avanzado",
];

const COLOR_FIELD: ConfigField = {
  key: "color",
  label: "Color",
  type: "color",
  group: "appearance",
};

const SHOW_TITLE_FIELD: ConfigField = {
  key: "showTitle",
  label: "Mostrar título",
  type: "switch",
  group: "appearance",
};

const SHOW_ICON_FIELD: ConfigField = {
  key: "showIcon",
  label: "Mostrar icono",
  type: "switch",
  group: "appearance",
};

const WINDOW_FIELD: ConfigField = {
  key: "windowMinutes",
  label: "Rango de tiempo",
  type: "select",
  group: "general",
  options: [
    { value: "60", label: "Última hora" },
    { value: "360", label: "Últimas 6 h" },
    { value: "1440", label: "Últimas 24 h" },
    { value: "4320", label: "Últimos 3 días" },
  ],
};

const UNIT_FIELD: ConfigField = {
  key: "unit",
  label: "Unidad",
  type: "text",
  group: "general",
  placeholder: "°C, %, hPa…",
};

const DECIMALS_FIELD: ConfigField = {
  key: "decimals",
  label: "Decimales",
  type: "number",
  group: "general",
  min: 0,
  max: 4,
  step: 1,
};

const ICON_OPTIONS = BUTTON_ICONS.map(({ value, label }) => ({ value, label }));

const CONFIRM_FIELDS: ConfigField[] = [
  {
    key: "confirmEnabled",
    label: "Pedir confirmación",
    type: "switch",
    group: "general",
  },
  {
    key: "confirmMessage",
    label: "Mensaje de confirmación",
    type: "text",
    group: "general",
    placeholder: "¿Deseas encender AC-01?",
    showIf: { key: "confirmEnabled", equals: true },
  },
];

function definition(def: WidgetDefinition): WidgetDefinition {
  return def;
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  numeric_card: definition({
    type: "numeric_card",
    label: "Numeric Card",
    description: "Valor actual grande con unidad y decimales.",
    category: "indicadores",
    icon: Thermometer,
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    dataKeys: "single",
    configSchema: [UNIT_FIELD, DECIMALS_FIELD, SHOW_ICON_FIELD, SHOW_TITLE_FIELD, COLOR_FIELD],
    defaults: { unit: "", decimals: 2, showIcon: true, showTitle: true, color: PALETTE[0] },
    Renderer: NumericCardRenderer,
  }),

  status_card: definition({
    type: "status_card",
    label: "Status Card",
    description: "Valor + badge de estado según rangos de alerta.",
    category: "indicadores",
    icon: Activity,
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    dataKeys: "single",
    configSchema: [
      UNIT_FIELD,
      DECIMALS_FIELD,
      { key: "warnBelow", label: "Alerta si menor que", type: "number", group: "advanced" },
      { key: "warnAbove", label: "Alerta si mayor que", type: "number", group: "advanced" },
      { key: "critBelow", label: "Crítico si menor que", type: "number", group: "advanced" },
      { key: "critAbove", label: "Crítico si mayor que", type: "number", group: "advanced" },
      SHOW_ICON_FIELD,
      SHOW_TITLE_FIELD,
      COLOR_FIELD,
    ],
    defaults: { unit: "", decimals: 2, showIcon: true, showTitle: true, color: PALETTE[1] },
    Renderer: StatusCardRenderer,
  }),

  kpi: definition({
    type: "kpi",
    label: "KPI",
    description: "Agregado en ventana temporal con tendencia.",
    category: "indicadores",
    icon: TrendingUp,
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    dataKeys: "single",
    configSchema: [
      {
        key: "aggregation",
        label: "Agregación",
        type: "select",
        group: "general",
        options: [
          { value: "last", label: "Último valor" },
          { value: "avg", label: "Promedio" },
          { value: "min", label: "Mínimo" },
          { value: "max", label: "Máximo" },
        ],
      },
      WINDOW_FIELD,
      DECIMALS_FIELD,
      { key: "showDelta", label: "Mostrar tendencia", type: "switch", group: "general" },
      UNIT_FIELD,
      COLOR_FIELD,
    ],
    defaults: {
      aggregation: "last",
      windowMinutes: 60,
      showDelta: true,
      decimals: 2,
      unit: "",
      color: PALETTE[5],
    },
    Renderer: KpiRenderer,
  }),

  line_chart: definition({
    type: "line_chart",
    label: "Line Chart",
    description: "Series temporales en líneas (multi-clave).",
    category: "graficos",
    icon: LineChartIcon,
    defaultSize: { w: 8, h: 3 },
    minSize: { w: 4, h: 2 },
    dataKeys: "multi",
    configSchema: [WINDOW_FIELD, { key: "showLegend", label: "Mostrar leyenda", type: "switch", group: "general" }, UNIT_FIELD, COLOR_FIELD],
    defaults: { windowMinutes: 1440, showLegend: false, unit: "", color: PALETTE[0] },
    Renderer: LineChartRenderer,
  }),

  area_chart: definition({
    type: "area_chart",
    label: "Area Chart",
    description: "Serie temporal con área con gradiente.",
    category: "graficos",
    icon: Route,
    defaultSize: { w: 8, h: 3 },
    minSize: { w: 4, h: 2 },
    dataKeys: "single",
    configSchema: [WINDOW_FIELD, UNIT_FIELD, COLOR_FIELD],
    defaults: { windowMinutes: 1440, unit: "", color: PALETTE[0] },
    Renderer: AreaChartRenderer,
  }),

  gauge: definition({
    type: "gauge",
    label: "Gauge",
    description: "Medidor radial con rango configurable.",
    category: "gauges",
    icon: GaugeIcon,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    dataKeys: "single",
    configSchema: [
      { key: "min", label: "Mínimo", type: "number", group: "general" },
      { key: "max", label: "Máximo", type: "number", group: "general" },
      UNIT_FIELD,
      DECIMALS_FIELD,
      COLOR_FIELD,
    ],
    defaults: { min: 0, max: 100, decimals: 1, unit: "", color: PALETTE[1] },
    Renderer: GaugeRenderer,
  }),

  button: definition({
    type: "button",
    label: "Button",
    description: "Botón de control con acción y confirmación.",
    category: "control",
    icon: MousePointerClick,
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 1 },
    dataKeys: "none",
    actionSlots: [{ key: "actionId", label: "Acción al presionar" }],
    configSchema: [
      { key: "icon", label: "Icono", type: "select", group: "appearance", options: ICON_OPTIONS },
      ...CONFIRM_FIELDS,
      COLOR_FIELD,
    ],
    defaults: { icon: "power", color: PALETTE[0], confirmEnabled: true, confirmMessage: "" },
    Renderer: ButtonRenderer,
  }),

  switch: definition({
    type: "switch",
    label: "Switch",
    description: "Interruptor ON/OFF con acciones separadas.",
    category: "control",
    icon: ToggleLeft,
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    dataKeys: "none",
    actionSlots: [
      { key: "onActionId", label: "Acción ON" },
      { key: "offActionId", label: "Acción OFF" },
    ],
    configSchema: [
      { key: "icon", label: "Icono", type: "select", group: "appearance", options: ICON_OPTIONS },
      ...CONFIRM_FIELDS,
      COLOR_FIELD,
    ],
    defaults: { icon: "toggle", color: PALETTE[1], confirmEnabled: false, confirmMessage: "" },
    Renderer: SwitchRenderer,
  }),

  data_table: definition({
    type: "data_table",
    label: "Data Table",
    description: "Último valor por clave del dispositivo.",
    category: "tablas",
    icon: Table2,
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 2 },
    dataKeys: "multi",
    configSchema: [DECIMALS_FIELD],
    defaults: { decimals: 2 },
    Renderer: DataTableRenderer,
  }),

  html_card: definition({
    type: "html_card",
    label: "HTML Card",
    description: "HTML/CSS en iframe aislado (JS en Fase 2).",
    category: "avanzado",
    icon: Code2,
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 3, h: 2 },
    dataKeys: "none",
    configSchema: [
      { key: "html", label: "HTML", type: "textarea", group: "general", rows: 6, placeholder: "<div class=\"card\">4.01 °C</div>" },
      { key: "css", label: "CSS", type: "textarea", group: "advanced", rows: 6, placeholder: ".card{font-size:28px}" },
      {
        key: "javascript",
        label: "JavaScript",
        type: "textarea",
        group: "advanced",
        rows: 4,
        help: "Se guarda pero es inerte: en Fase 2 se ejecutará dentro del iframe sandbox con un contexto de datos restringido.",
      },
      COLOR_FIELD,
    ],
    defaults: {
      html: "<div class=\"saludo\">Hola IMIND</div>",
      css: ".saludo{font-size:22px;font-weight:600;color:#0891b2;}",
      javascript: "",
      color: PALETTE[4],
    },
    Renderer: HtmlCardRenderer,
  }),

  // Legacy v1: solo lectura de dashboards migrados; no aparece en la biblioteca.
  alarms: definition({
    type: "alarms",
    label: "Alarmas activas (legacy)",
    description: "Lista de alarmas activas del dispositivo (tipo v1).",
    category: "legacy",
    icon: Zap,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    dataKeys: "none",
    configSchema: [SHOW_TITLE_FIELD, COLOR_FIELD],
    defaults: { showTitle: true, color: PALETTE[3] },
    Renderer: LegacyAlarmsRenderer,
  }),
};

/** Definición con fallback para tipos desconocidos (docs corruptos/futuros). */
export function getWidgetDefinition(type: string): WidgetDefinition {
  const def = WIDGET_REGISTRY[type as WidgetType];
  if (def) return def;
  return {
    type: "numeric_card",
    label: type || "Desconocido",
    description: "Tipo de widget no registrado",
    category: "legacy",
    icon: AlignLeft,
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 2, h: 2 },
    dataKeys: "none",
    configSchema: [],
    defaults: {},
    Renderer: UnknownRenderer,
  };
}

function UnknownRenderer({ widget }: { widget: { title: string } }) {
  return (
    <div className="glass flex h-full flex-col items-center justify-center rounded-xl p-4 text-center">
      <p className="text-sm font-semibold">{widget.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Este tipo de widget no está registrado en esta versión.
      </p>
    </div>
  );
}

/** ¿Debe aparecer el tipo en la biblioteca de "Agregar widget"? */
export function isInLibrary(type: WidgetType): boolean {
  return WIDGET_CATEGORY_ORDER.includes(WIDGET_REGISTRY[type].category);
}

/** Tipos disponibles en la biblioteca, ordenados por categoría. */
export function libraryTypes(): WidgetType[] {
  return (Object.keys(WIDGET_REGISTRY) as WidgetType[]).filter(isInLibrary);
}

/** Fusiona defaults del tipo con la configuración guardada del widget. */
export function configWithDefaults(
  type: WidgetType,
  configuration: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return { ...getWidgetDefinition(type).defaults, ...(configuration ?? {}) };
}

/** Crea la instancia de widget por defecto de un tipo (sin datasource). */
export function createDefaultWidget(
  type: WidgetType,
  position: WidgetSize & { x: number; y: number },
  title?: string,
): ReturnType<typeof buildWidget> {
  return buildWidget(type, position, title);
}

function buildWidget(
  type: WidgetType,
  position: WidgetSize & { x: number; y: number },
  title?: string,
) {
  const def = getWidgetDefinition(type);
  return {
    id: newId("w"),
    type,
    title: title ?? def.label,
    position: { x: position.x, y: position.y, w: position.w, h: position.h },
    datasourceIds: [],
    actionIds: [],
    configuration: { ...def.defaults },
  };
}
