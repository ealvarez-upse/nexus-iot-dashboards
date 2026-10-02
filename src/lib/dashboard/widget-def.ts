/**
 * Contratos del sistema de widgets (fuera del modelo: el modelo es datos puro).
 * El REGISTRY une: tipo → metadata + schema de configuración + Renderer.
 * Agregar un widget nuevo = crear Renderer + registrar entrada. El núcleo del
 * builder (canvas, drag, guardado) no se modifica.
 */

import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { Action, Widget, WidgetType } from "./model";
import type { WidgetData } from "./datasource";

export type WidgetCategory =
  | "indicadores"
  | "graficos"
  | "gauges"
  | "control"
  | "tablas"
  | "avanzado"
  | "legacy";

export interface WidgetSize {
  w: number;
  h: number;
}

export type ConfigFieldType =
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "switch"
  | "color";

/** Campo declarativo del formulario de configuración de un tipo de widget. */
export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  group?: "general" | "appearance" | "advanced";
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  /** Solo mostrar el campo si otro campo tiene este valor. */
  showIf?: { key: string; equals: string | number | boolean };
  /** Filas para textarea. */
  rows?: number;
}

/** Ranura de acción de un widget (Button: 1, Switch: 2). */
export interface ActionSlot {
  key: string;
  label: string;
}

/** Props que el frame entrega a cada renderer. Sin Convex, sin providers. */
export interface WidgetRendererProps {
  widget: Widget;
  /** Configuración ya fusionada con los defaults del registry. */
  config: Record<string, unknown>;
  data: WidgetData;
  editMode: boolean;
  /** Acciones del documento indexadas por id (para Button/Switch). */
  actionsById: Record<string, Action>;
}

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  description: string;
  category: WidgetCategory;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  /** Cómo pedir claves al datasource: una, varias o ninguna. */
  dataKeys: "single" | "multi" | "none";
  actionSlots?: ActionSlot[];
  configSchema: ConfigField[];
  defaults: Record<string, unknown>;
  Renderer: ComponentType<WidgetRendererProps>;
}
