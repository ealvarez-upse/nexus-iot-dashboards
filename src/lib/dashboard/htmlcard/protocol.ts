/**
 * ============================================================
 *  PROTOCOLO DEL HTML CARD — puente host ⇄ iframe sandbox
 * ============================================================
 *
 * Mensajes en AMBOS sentidos con marca `__imind: true`, tipos en
 * whitelist y validación de forma en los dos lados:
 *  - Sandbox → host: `imind:ready` | `imind:error` | `imind:action`.
 *    El host SOLO acepta mensajes con `event.source === iframe.contentWindow`.
 *  - Host → sandbox: `imind:init` | `imind:data` (snapshot) y
 *    `imind:action_result`. El runtime del sandbox valida el remitente
 *    (`event.source === window.parent`) y la forma del snapshot.
 *
 * El snapshot es una LISTA BLANCA de datos ya autorizados por
 * useWidgetData: latest, series recortadas y device público. Nunca
 * transporta objetos de Convex, sesiones, tokens ni funciones.
 */

import type { Action } from "../model";
import type { WidgetData } from "../datasource";

export const IMIND_MSG_KEY = "__imind";
/** Puntos por serie entregados al sandbox (getSeries lee de este recorte). */
export const SERIES_PREVIEW_LIMIT = 120;
/** Tiempo de espera de una acción antes de responder timeout al sandbox. */
export const ACTION_TIMEOUT_MS = 10_000;
/** Tope de acciones simultáneas en vuelo por widget. */
export const MAX_IN_FLIGHT_ACTIONS = 5;
export const MAX_TOKEN_LENGTH = 64;
export const MAX_ERROR_LENGTH = 500;

/** Referencia de acción permitida: token expuesto al JS + índice en widget.actionIds. */
export interface AllowedAction {
  token: string;
  index: number;
  /** Si true, el host pide confirmación (window.confirm) antes de ejecutar. */
  confirm?: boolean;
}

/** Device público entregado al sandbox (sin umbrales, tokens ni datos internos). */
export interface SandboxDevice {
  id: string;
  name: string;
  label?: string;
  battery?: number;
  lastSeenAt?: number;
}

/** Snapshot autorizado que viaja al sandbox. */
export interface ImindSnapshot {
  loading: boolean;
  latest: Record<string, number | undefined>;
  series: Record<string, { ts: number; value: number }[]>;
  device: SandboxDevice | null;
}

export type SandboxToHostMessage =
  | { type: "imind:ready" }
  | { type: "imind:error"; message: string }
  | { type: "imind:action"; token: string; requestId: number };

export type HostToSandboxMessage =
  | { type: "imind:init"; snapshot: ImindSnapshot }
  | { type: "imind:data"; snapshot: ImindSnapshot }
  | { type: "imind:action_result"; requestId: number; ok: boolean; message: string };

/**
 * Lee/valida `allowedActions` desde la configuración guardada del widget.
 * Entradas malformadas se descartan (defensa frente a datos corrompidos).
 */
export function parseAllowedActions(value: unknown): AllowedAction[] {
  if (!Array.isArray(value)) return [];
  const out: AllowedAction[] = [];
  for (const raw of value) {
    if (!isPlainObject(raw)) continue;
    if (typeof raw.token !== "string" || raw.token.length === 0 || raw.token.length > MAX_TOKEN_LENGTH) continue;
    if (typeof raw.index !== "number" || !Number.isInteger(raw.index) || raw.index < 0) continue;
    out.push({ token: raw.token, index: raw.index, ...(raw.confirm === true ? { confirm: true } : {}) });
  }
  return out;
}

/** Recorta una serie a los últimos N puntos. */
export function seriesPreview(points: { ts: number; value: number }[] | undefined): { ts: number; value: number }[] {
  if (!points || points.length === 0) return [];
  return points.length > SERIES_PREVIEW_LIMIT ? points.slice(points.length - SERIES_PREVIEW_LIMIT) : points;
}

/**
 * Construye el snapshot whitelisted desde WidgetData (capa de datos existente).
 * Elimina cualquier campo extra del device: solo id/name/label/battery/lastSeenAt.
 */
export function buildSnapshot(data: WidgetData): ImindSnapshot {
  const series: ImindSnapshot["series"] = {};
  for (const key of Object.keys(data.series)) {
    series[key] = seriesPreview(data.series[key]);
  }
  let device: SandboxDevice | null = null;
  if (data.device && typeof data.device._id === "string" && data.device._id !== "") {
    device = {
      id: data.device._id,
      name: typeof data.device.name === "string" ? data.device.name : "",
      ...(typeof data.device.label === "string" && data.device.label !== "" ? { label: data.device.label } : {}),
      ...(typeof data.device.battery === "number" ? { battery: data.device.battery } : {}),
      ...(typeof data.device.lastSeenAt === "number" ? { lastSeenAt: data.device.lastSeenAt } : {}),
    };
  }
  return { loading: data.loading, latest: data.latest ?? {}, series, device };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Valida un mensaje que llega DESDE el sandbox. Devuelve null si no cumple
 * la marca, el tipo de la whitelist o la forma esperada.
 */
export function parseSandboxMessage(data: unknown): SandboxToHostMessage | null {
  if (!isPlainObject(data) || data[IMIND_MSG_KEY] !== true) return null;
  const type = data.type;
  if (type === "imind:ready") return { type: "imind:ready" };
  if (type === "imind:error") {
    if (typeof data.message !== "string") return null;
    return { type: "imind:error", message: data.message.slice(0, MAX_ERROR_LENGTH) };
  }
  if (type === "imind:action") {
    if (typeof data.token !== "string" || data.token.length === 0 || data.token.length > MAX_TOKEN_LENGTH) return null;
    if (typeof data.requestId !== "number" || !Number.isFinite(data.requestId)) return null;
    return { type: "imind:action", token: data.token, requestId: data.requestId };
  }
  return null;
}

/** Valida la forma de un snapshot antes de enviarlo al sandbox (defensa extra). */
export function isSnapshotShape(value: unknown): value is ImindSnapshot {
  if (!isPlainObject(value)) return false;
  if (typeof value.loading !== "boolean") return false;
  if (!isPlainObject(value.latest) || !isPlainObject(value.series)) return false;
  if (value.device !== null && !isPlainObject(value.device)) return false;
  return true;
}

export type ResolveActionResult =
  | { ok: true; action: Action; confirm: boolean }
  | { ok: false; message: string };

/**
 * Resuelve un token pedido por el JS del sandbox contra las acciones
 * PERMITIDAS del widget. Un token que no esté en la lista nunca llega al
 * executor: la whitelist se comprueba en el host, no en el sandbox.
 */
export function resolveAllowedAction(
  allowed: AllowedAction[] | undefined,
  token: string,
  actionIds: string[],
  actionsById: Record<string, Action>,
): ResolveActionResult {
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return { ok: false, message: "El widget no tiene acciones permitidas configuradas" };
  }
  const entry = allowed.find((a) => a && a.token === token);
  if (!entry) return { ok: false, message: `Token de acción no permitido: ${token}` };
  const actionId = actionIds[entry.index];
  if (!actionId) return { ok: false, message: "La acción permitida no está configurada" };
  const action = actionsById[actionId];
  if (!action) return { ok: false, message: "La acción ya no existe en el dashboard" };
  if (!action.target) return { ok: false, message: "La acción no tiene destino configurado" };
  return { ok: true, action, confirm: entry.confirm === true };
}
