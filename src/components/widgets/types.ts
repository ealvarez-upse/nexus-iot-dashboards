/** Tipos compartidos del builder de widgets */
export type WidgetType = "timeSeries" | "valueCard" | "gauge";
export type WidgetWidth = "1/3" | "1/2" | "2/3" | "1";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  deviceId: string;
  dataKey: string;
  unit?: string;
  color?: string;
  width: WidgetWidth;
}

export const WIDGET_WIDTH_CLASS: Record<WidgetWidth, string> = {
  "1/3": "lg:col-span-2",
  "1/2": "lg:col-span-3",
  "2/3": "lg:col-span-4",
  "1": "lg:col-span-6",
};

export const WIDGET_TYPE_LABEL: Record<WidgetType, string> = {
  timeSeries: "Serie temporal",
  valueCard: "Valor actual",
  gauge: "Indicador",
};

export const PALETTE = [
  "#0891b2", // cian
  "#0d9488", // teal
  "#ca8a04", // ámbar
  "#dc2626", // rojo
  "#7c3aed", // violeta
  "#2563eb", // azul
  "#16a34a", // verde
];
