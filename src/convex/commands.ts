import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

/**
 * Transporte SIMULADO de comandos para acciones de widgets (Button/Switch).
 *
 * Flujo de arquitectura: Action → ActionExecutor → Provider (este mutation).
 * En Fase 5 se agregará un transporte MQTT/HTTP real sin cambiar widgets ni
 * renderers: solo se sustituye el provider del executor.
 *
 * Seguridad: requiere sesión activa y solo permite enviar comandos a
 * dispositivos propios o (siendo admin) de cualquier usuario.
 */
export const simulate = mutation({
  args: {
    entityType: v.union(v.literal("device")),
    entityId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { entityType, entityId, payload }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    const user = await ctx.db.get(userId);

    if (entityType !== "device") throw new Error("Tipo de entidad no soportado");
    const device = await ctx.db.get(entityId as Id<"devices">);
    if (!device) throw new Error("Dispositivo destino no encontrado");

    if (device.createdBy && device.createdBy !== userId && user?.role !== "admin") {
      throw new Error("Sin permisos para enviar comandos a este dispositivo");
    }

    const payloadText = JSON.stringify(payload ?? {});
    await ctx.db.insert("events", {
      deviceId: device._id,
      type: "command.sent",
      message: `Comando enviado a ${device.name}: ${payloadText}`,
      ts: Date.now(),
    });
    return { ok: true, message: `${device.name} → ${payloadText}` };
  },
});
