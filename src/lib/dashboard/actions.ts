/**
 * ============================================================
 *  SISTEMA DE ACCIONES — independiente del transporte
 * ============================================================
 *
 * Flujo:  Action (modelo) → useActionExecutor() → Provider → destino
 *
 * Hoy existe únicamente el transporte SIMULADO (`api.commands.simulate`),
 * que registra un evento `command.sent` visible en el Resumen. En Fase 5 se
 * agregan ActionTransports MQTT/HTTP a la tabla `TRANSPORTS` sin cambiar
 * widgets, renderers ni el modelo.
 */

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Action } from "./model";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Transporte de ejecución de acciones. Un widget nunca envía comandos por su
 * cuenta: siempre delega en el executor, que resuelve el transporte.
 */
export interface ActionTransport {
  id: string;
  label: string;
  send(input: {
    action: Action;
    payload: Record<string, unknown>;
  }): Promise<ActionResult>;
}

/**
 * Executor de acciones vinculado al transporte simulado actual.
 * Devuelve una función estable lista para usar desde renderers.
 */
export function useActionExecutor() {
  const simulate = useMutation(api.commands.simulate);

  return useCallback(
    async (
      action: Action | undefined,
      payloadOverride?: Record<string, unknown>,
    ): Promise<ActionResult> => {
      if (!action) return { ok: false, message: "El widget no tiene acción configurada" };
      if (!action.target) {
        return { ok: false, message: "La acción no tiene destino configurado" };
      }
      const payload = { ...(action.payload ?? {}), ...(payloadOverride ?? {}) };
      try {
        const res = (await simulate({
          entityType: action.target.entityType,
          entityId: action.target.entityId,
          payload,
        })) as ActionResult;
        return res;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error al ejecutar la acción";
        return { ok: false, message };
      }
    },
    [simulate],
  );
}

/** Etiqueta legible de un destino, para confirmaciones y toasts. */
export function describeTargetLabel(action: Action | undefined, deviceName?: string): string {
  if (!action?.target) return "destino";
  return deviceName || action.target.entityId;
}
