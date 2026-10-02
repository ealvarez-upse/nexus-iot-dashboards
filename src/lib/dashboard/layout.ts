/**
 * ============================================================
 *  MOTOR DE LAYOUT — cuadrícula de 12 columnas
 * ============================================================
 *
 * El modelo guarda posiciones LÓGICAS { x, y, w, h } en unidades de
 * cuadrícula; este motor es el ÚNICO que convierte a píxeles:
 *   px(w) = w·colWidth + (w−1)·margin
 *   left  = x·(colWidth + margin)
 * La altura de fila (px) es solo referencia del motor, nunca del modelo.
 */

import type { DashboardSettings, Widget, WidgetPosition } from "./model";
import type { WidgetSize } from "./widget-def";

export interface GridMetrics {
  columns: number;
  rowHeight: number;
  margin: number;
  colWidth: number;
  containerWidth: number;
}

export function computeMetrics(
  containerWidth: number,
  settings: DashboardSettings,
): GridMetrics {
  const columns = Math.max(1, Math.floor(settings.columns));
  const margin = Math.max(0, settings.margin);
  const colWidth = Math.max(
    48,
    (Math.max(containerWidth, 320) - margin * (columns - 1)) / columns,
  );
  return { columns, rowHeight: settings.rowHeight, margin, colWidth, containerWidth };
}

export function pxX(x: number, m: GridMetrics): number {
  return Math.round(x * (m.colWidth + m.margin));
}

export function pxY(y: number, m: GridMetrics): number {
  return Math.round(y * (m.rowHeight + m.margin));
}

export function pxW(w: number, m: GridMetrics): number {
  return Math.round(w * m.colWidth + Math.max(0, w - 1) * m.margin);
}

export function pxH(h: number, m: GridMetrics): number {
  return Math.round(h * m.rowHeight + Math.max(0, h - 1) * m.margin);
}

/** Altura total del lienzo en px (bottom máximo de todos los widgets). */
export function canvasHeight(widgets: Widget[], m: GridMetrics): number {
  let maxBottom = 0;
  for (const widget of widgets) {
    const bottom = pxY(widget.position.y, m) + pxH(widget.position.h, m);
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return maxBottom;
}

/** Mueve un widget dentro de los límites de la cuadrícula. */
export function clampMove(
  orig: WidgetPosition,
  dx: number,
  dy: number,
  columns: number,
): WidgetPosition {
  const x = Math.min(Math.max(orig.x + dx, 0), Math.max(0, columns - orig.w));
  const y = Math.max(orig.y + dy, 0);
  return { ...orig, x, y };
}

/** Redimensiona respetando tamaño mínimo y bordes de la cuadrícula. */
export function clampResize(
  orig: WidgetPosition,
  dw: number,
  dh: number,
  min: WidgetSize,
  columns: number,
): WidgetPosition {
  const w = Math.min(Math.max(orig.w + dw, min.w), Math.max(min.w, columns - orig.x));
  const h = Math.max(orig.h + dh, min.h);
  return { ...orig, w, h };
}

/** Celdas ocupadas por un widget. */
function markOccupied(occupied: Set<string>, pos: WidgetPosition) {
  for (let dx = 0; dx < pos.w; dx++) {
    for (let dy = 0; dy < pos.h; dy++) {
      occupied.add(`${pos.x + dx},${pos.y + dy}`);
    }
  }
}

/** Primera posición libre para un widget nuevo de tamaño (w, h). */
export function findFreePosition(
  widgets: Widget[],
  w: number,
  h: number,
  columns: number,
): WidgetPosition {
  const occupied = new Set<string>();
  let maxY = 0;
  for (const widget of widgets) {
    markOccupied(occupied, widget.position);
    maxY = Math.max(maxY, widget.position.y + widget.position.h);
  }
  const limitY = maxY + h + 12;
  for (let y = 0; y <= limitY; y++) {
    for (let x = 0; x + w <= columns; x++) {
      let free = true;
      for (let dx = 0; dx < w && free; dx++) {
        for (let dy = 0; dy < h && free; dy++) {
          if (occupied.has(`${x + dx},${y + dy}`)) free = false;
        }
      }
      if (free) return { x, y, w, h };
    }
  }
  return { x: 0, y: maxY, w, h };
}
