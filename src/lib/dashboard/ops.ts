/**
 * Operaciones del builder sobre el modelo IMIND (UI local).
 * Única implementación de duplicar/eliminar/limpiar: DashboardViewPage, el
 * diálogo de configuración y las pruebas consumen estas funciones, de modo
 * que las reglas (clonación de acciones, limpieza de huérfanos) se aplican
 * igual en cualquier superficie.
 */

import { cloneModel, newId, type Action, type ImindDashboard, type Widget } from "./model";
import { findFreePosition } from "./layout";

/** Elimina datasources/acciones sin referencia desde ningún widget. */
export function stripOrphans(model: ImindDashboard): ImindDashboard {
  const usedActions = new Set<string>();
  const usedDatasources = new Set<string>();
  for (const w of model.widgets) {
    for (const id of w.actionIds) usedActions.add(id);
    for (const id of w.datasourceIds) usedDatasources.add(id);
  }
  return {
    ...model,
    actions: model.actions.filter((a) => usedActions.has(a.id)),
    datasources: model.datasources.filter((d) => usedDatasources.has(d.id)),
  };
}

/**
 * Duplica un widget con acciones INDEPENDIENTES:
 *  - Las acciones exclusivas del widget original se CLONAN (nueva id vía
 *    newId, mismos trigger/type/target/payload) y la copia apunta a los clones.
 *  - Las acciones COMPARTIDAS con otros widgets se re-referencian sin clonar
 *    (no son locales del widget; duplicarlas crearía copias colgantes).
 * El original queda intacto: seguir usándolo tras editar la copia es seguro.
 */
export function duplicateWidget(model: ImindDashboard, widgetId: string): { model: ImindDashboard; newWidgetId: string | null } {
  const source = model.widgets.find((w) => w.id === widgetId);
  if (!source) return { model, newWidgetId: null };
  const next = cloneModel(model);

  const newWidgetId = newId("w");
  const usage = new Map<string, number>();
  for (const w of next.widgets) {
    for (const id of w.actionIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  }

  const copyActionIds: string[] = [];
  for (const id of source.actionIds) {
    const original = next.actions.find((a) => a.id === id);
    if (!original) continue;
    if ((usage.get(id) ?? 0) === 1) {
      const clone: Action = { ...original, id: newId("act") };
      next.actions.push(clone);
      copyActionIds.push(clone.id);
    } else {
      copyActionIds.push(id);
    }
  }

  const copy: Widget = {
    ...cloneModel(source),
    id: newWidgetId,
    title: `${source.title} (copia)`,
    position: findFreePosition(next.widgets, source.position.w, source.position.h, next.settings.columns),
    datasourceIds: [...source.datasourceIds],
    actionIds: copyActionIds,
  };
  next.widgets.push(copy);
  return { model: next, newWidgetId };
}

/** Elimina un widget y limpia datasources/acciones que quedaron sin dueño. */
export function removeWidget(model: ImindDashboard, widgetId: string): ImindDashboard {
  const next = cloneModel(model);
  next.widgets = next.widgets.filter((w) => w.id !== widgetId);
  return stripOrphans(next);
}
