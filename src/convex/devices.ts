import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { thresholdsValidator } from "./schema";
import { internal } from "./_generated/api";

function randomToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type ThresholdRange = { min?: number; max?: number };
type DeviceThresholds = {
  temperature?: ThresholdRange;
  humidity?: ThresholdRange;
  battery?: ThresholdRange;
};

/**
 * Evalúa si un valor dispara alarma según los umbrales del dispositivo.
 * Las lecturas demo ignoran el umbral de batería para no llenar la plataforma
 * de alarmas falsas mientras la batería simulada se agota.
 */
function evaluateThresholds(
  thresholds: DeviceThresholds | undefined,
  key: string,
  value: number,
  isDemo: boolean,
): { type: "max" | "min"; threshold: number; severity: "critical" | "warning" } | null {
  if (!thresholds) return null;
  const range = thresholds[key as keyof DeviceThresholds];
  if (!range) return null;
  if (key === "battery" && isDemo) return null;

  if (typeof range.max === "number" && value > range.max) {
    return {
      type: "max",
      threshold: range.max,
      severity: value > range.max + (Math.abs(range.max) > 0 ? Math.abs(range.max) * 0.1 : 1) ? "critical" : "warning",
    };
  }
  if (typeof range.min === "number" && value < range.min) {
    return {
      type: "min",
      threshold: range.min,
      severity: value < range.min - (Math.abs(range.min) > 0 ? Math.abs(range.min) * 0.1 : 1) ? "critical" : "warning",
    };
  }
  return null;
}

/** Lista todos los dispositivos con su último estado por clave y alarmas abiertas. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").order("desc").collect();
    const result = [];
    for (const device of devices) {
      const latest = await ctx.db
        .query("telemetry")
        .withIndex("by_device_ts", (q) => q.eq("deviceId", device._id))
        .order("desc")
        .take(12);
      const keys: Record<string, { value: number; ts: number }> = {};
      for (const row of latest) {
        if (!keys[row.key]) keys[row.key] = { value: row.value, ts: row.ts };
      }
      const openAlarms = await ctx.db
        .query("alarms")
        .withIndex("by_device", (q) => q.eq("deviceId", device._id))
        .filter((q) => q.eq(q.field("open"), true))
        .collect();
      result.push({ ...device, latest: keys, openAlarms: openAlarms.length });
    }
    return result;
  },
});

/** Detalle de un dispositivo. */
export const get = query({
  args: { id: v.id("devices") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/** Crea dispositivo con token de acceso único (como ThingsBoard). */
export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("gateway"), v.literal("sensor")),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { name, type, label }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    const id = await ctx.db.insert("devices", {
      name,
      type,
      label,
      token: randomToken(),
      createdBy: userId,
    });
    await ctx.db.insert("events", {
      deviceId: id,
      type: "device.created",
      message: `Dispositivo "${name}" registrado`,
      ts: Date.now(),
    });
    return id;
  },
});

/** Actualiza nombre, tipo y ubicación de un dispositivo. */
export const update = mutation({
  args: {
    id: v.id("devices"),
    name: v.optional(v.string()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, label }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (label !== undefined) patch.label = label;
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch as never);
  },
});

/** Elimina dispositivo, su telemetría y sus alarmas. */
export const remove = mutation({
  args: { id: v.id("devices") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    const rows = await ctx.db
      .query("telemetry")
      .withIndex("by_device_ts", (q) => q.eq("deviceId", id))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    const deviceAlarms = await ctx.db
      .query("alarms")
      .withIndex("by_device", (q) => q.eq("deviceId", id))
      .collect();
    for (const a of deviceAlarms) await ctx.db.delete(a._id);
    await ctx.db.delete(id);
  },
});

/** Regenera el token de acceso de un dispositivo. */
export const rotateToken = mutation({
  args: { id: v.id("devices") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    await ctx.db.patch(id, { token: randomToken() });
  },
});

/** Configura umbrales de alarma por clave (estilo ThingsBoard). */
export const setThresholds = mutation({
  args: {
    id: v.id("devices"),
    thresholds: thresholdsValidator,
  },
  handler: async (ctx, { id, thresholds }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    await ctx.db.patch(id, { thresholds });
    const device = await ctx.db.get(id);
    await ctx.db.insert("events", {
      deviceId: id,
      type: "device.thresholds",
      message: `Umbrales actualizados en ${device?.name ?? "dispositivo"}`,
      ts: Date.now(),
    });
  },
});

/** Últimas N lecturas por clave para gráficas en vivo. */
export const latestSeries = query({
  args: {
    deviceId: v.id("devices"),
    keys: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { deviceId, keys, limit }) => {
    const max = limit ?? 240;
    const series: Record<string, { ts: number; value: number }[]> = {};
    for (const key of keys) {
      const rows = await ctx.db
        .query("telemetry")
        .withIndex("by_device_key_ts", (q) =>
          q.eq("deviceId", deviceId).eq("key", key),
        )
        .order("desc")
        .take(max);
      series[key] = rows.reverse().map((r) => ({ ts: r.ts, value: r.value }));
    }
    return series;
  },
});

/** Claves de telemetría distintas que ha emitido un dispositivo. */
export const knownKeys = query({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const rows = await ctx.db
      .query("telemetry")
      .withIndex("by_device_ts", (q) => q.eq("deviceId", deviceId))
      .order("desc")
      .take(500);
    const keys: Record<string, number> = {};
    for (const row of rows) keys[row.key] = (keys[row.key] ?? 0) + 1;
    return Object.keys(keys);
  },
});

/** Inserta telemetría desde un dispositivo autenticado por token (HTTP API). */
export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query("devices")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
  },
});

/** Ingesta de telemetría usada por el endpoint HTTP, con evaluación de umbrales. */
export const ingestInternal = internalMutation({
  args: {
    deviceId: v.id("devices"),
    values: v.array(v.object({ key: v.string(), value: v.number() })),
    ts: v.number(),
  },
  handler: async (ctx, { deviceId, values, ts }) => {
    const device = await ctx.db.get(deviceId);
    if (!device) return;
    const thresholds = device.thresholds as DeviceThresholds | undefined;

    for (const { key, value } of values) {
      await ctx.db.insert("telemetry", { deviceId, key, value, ts });
      const breach = evaluateThresholds(thresholds, key, value, device.isDemo === true);
      if (breach) {
        await ctx.runMutation(internal.alarms.createInternal, {
          deviceId,
          deviceName: device.name,
          dataKey: key,
          type: breach.type,
          threshold: breach.threshold,
          value,
          severity: breach.severity,
        });
      } else if (thresholds && thresholds[key as keyof DeviceThresholds]) {
        await ctx.runMutation(internal.alarms.clearInternal, { deviceId, dataKey: key });
      }
    }

    await ctx.db.patch(deviceId, { lastSeenAt: ts });
    if (device.type === "sensor") {
      const battery = values.find((v2) => v2.key === "battery")?.value;
      if (battery !== undefined) await ctx.db.patch(deviceId, { battery });
    }
  },
});
