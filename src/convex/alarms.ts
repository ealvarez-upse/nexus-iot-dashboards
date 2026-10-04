import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

/**
 * Reglas de acceso de alarmas: el backend NO se fía del frontend.
 *  - Lectura y escritura requieren sesión activa.
 *  - Un usuario solo ve/actúa sobre alarmas de dispositivos propios
 *    (o demo/plataforma sin creador); el admin ve todo.
 */
export async function requireDeviceRead(
  ctx: { db: unknown },
  userId: Id<"users">,
  deviceId: Id<"devices">,
): Promise<boolean> {
  const db = ctx.db as {
    get: (id: Id<"users"> | Id<"devices">) => Promise<unknown>;
  };
  const user = (await db.get(userId)) as { role?: string } | null;
  if (user?.role === "admin") return true;
  const device = (await db.get(deviceId)) as { createdBy?: Id<"users"> } | null;
  if (!device) return false;
  return device.createdBy === undefined || device.createdBy === userId;
}

/** Lista alarmas (más recientes primero), opcionalmente filtradas. */
export const list = query({
  args: {
    deviceId: v.optional(v.id("devices")),
    status: v.optional(
      v.union(v.literal("active"), v.literal("cleared"), v.literal("all")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { deviceId, status, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    const user = await ctx.db.get(userId);
    const devices = await ctx.db.query("devices").collect();
    const allowed = new Set<string>();
    for (const d of devices) {
      if (user?.role === "admin" || d.createdBy === undefined || d.createdBy === userId) {
        allowed.add(d._id);
      }
    }
    const max = limit ?? 100;
    const alarms = await ctx.db.query("alarms").withIndex("by_ts").order("desc").take(400);
    return alarms
      .filter((a) => {
        if (deviceId && a.deviceId !== deviceId) return false;
        if (status === "active" && !a.open) return false;
        if (status === "cleared" && a.open) return false;
        return true;
      })
      .filter((a) => allowed.has(a.deviceId))
      .slice(0, max);
  },
});

/** Número de alarmas activas (para el badge del menú). */
export const activeCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const user = await ctx.db.get(userId);
    const rows = await ctx.db
      .query("alarms")
      .withIndex("by_open", (q) => q.eq("open", true))
      .collect();
    if (user?.role === "admin") return rows.length;
    const devices = await ctx.db.query("devices").collect();
    const allowed = new Set<string>();
    for (const d of devices) {
      if (d.createdBy === undefined || d.createdBy === userId) allowed.add(d._id);
    }
    return rows.filter((a) => allowed.has(a.deviceId)).length;
  },
});

/** Marca una alarma como reconocida (confirmada). */
export const ack = mutation({
  args: { id: v.id("alarms") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    const alarm = await ctx.db.get(id);
    if (!alarm) throw new Error("Alarma no encontrada");
    if (!(await requireDeviceRead(ctx, userId, alarm.deviceId))) {
      throw new Error("Sin permisos sobre esta alarma");
    }
    await ctx.db.patch(id, {
      status: alarm.open ? "active_ack" : "cleared_ack",
      ackTs: Date.now(),
      ackBy: userId,
    });
  },
});

/** Cierra manualmente una alarma activa. */
export const clear = mutation({
  args: { id: v.id("alarms") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    const alarm = await ctx.db.get(id);
    if (!alarm) throw new Error("Alarma no encontrada");
    if (!(await requireDeviceRead(ctx, userId, alarm.deviceId))) {
      throw new Error("Sin permisos sobre esta alarma");
    }
    if (!alarm.open) return;
    await ctx.db.patch(id, {
      open: false,
      endTs: Date.now(),
      status: "cleared_ack",
      ackTs: Date.now(),
      ackBy: userId,
    });
    await ctx.db.insert("events", {
      deviceId: alarm.deviceId,
      type: "alarm.cleared",
      message: `Alarma cerrada manualmente · ${alarm.deviceName} · ${alarm.dataKey}`,
      ts: Date.now(),
    });
  },
});

/** Reconoce todas las alarmas activas de un dispositivo. */
export const ackAllForDevice = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    if (!(await requireDeviceRead(ctx, userId, deviceId))) {
      throw new Error("Sin permisos sobre este dispositivo");
    }
    const open = await ctx.db
      .query("alarms")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .filter((q) => q.eq(q.field("open"), true))
      .collect();
    const now = Date.now();
    for (const a of open) {
      await ctx.db.patch(a._id, {
        status: "active_ack",
        ackTs: now,
        ackBy: userId,
      });
    }
    return open.length;
  },
});

/** Crea una alarma durante la ingesta de telemetría (uso interno). */
export const createInternal = internalMutation({
  args: {
    deviceId: v.id("devices"),
    deviceName: v.string(),
    dataKey: v.string(),
    type: v.union(v.literal("max"), v.literal("min")),
    threshold: v.number(),
    value: v.number(),
    severity: v.union(v.literal("critical"), v.literal("warning")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("alarms")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("open"), true))
      .filter((q) => q.eq(q.field("dataKey"), args.dataKey))
      .first();
    if (existing) {
      // Actualiza el valor más extremo observado durante el episodio
      if (
        (args.type === "max" && args.value > existing.value) ||
        (args.type === "min" && args.value < existing.value)
      ) {
        await ctx.db.patch(existing._id, { value: args.value });
      }
      return existing._id;
    }
    const id = await ctx.db.insert("alarms", {
      deviceId: args.deviceId,
      deviceName: args.deviceName,
      dataKey: args.dataKey,
      type: args.type,
      threshold: args.threshold,
      value: args.value,
      severity: args.severity,
      status: "active_unack",
      open: true,
      startTs: Date.now(),
    });
    await ctx.db.insert("events", {
      deviceId: args.deviceId,
      type: "alarm.raised",
      message: `Alarma ${args.severity === "critical" ? "crítica" : "de aviso"}: ${args.dataKey} ${args.type === "max" ? "sobre" : "bajo"} el límite en ${args.deviceName}`,
      ts: Date.now(),
    });
    return id;
  },
});

/** Cierra alarmas abiertas cuando el valor vuelve al rango (uso interno). */
export const clearInternal = internalMutation({
  args: {
    deviceId: v.id("devices"),
    dataKey: v.string(),
  },
  handler: async (ctx, { deviceId, dataKey }) => {
    const open = await ctx.db
      .query("alarms")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .filter((q) => q.eq(q.field("open"), true))
      .filter((q) => q.eq(q.field("dataKey"), dataKey))
      .collect();
    const now = Date.now();
    for (const a of open) {
      await ctx.db.patch(a._id, {
        open: false,
        endTs: now,
        status: "cleared_unack",
      });
      await ctx.db.insert("events", {
        deviceId,
        type: "alarm.auto_cleared",
        message: `${dataKey} volvió al rango en ${a.deviceName} · alarma cerrada`,
        ts: now,
      });
    }
  },
});
