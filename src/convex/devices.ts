import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

function randomToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Lista todos los dispositivos con su último estado por clave. */
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
      result.push({ ...device, latest: keys });
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

/** Elimina dispositivo y su telemetría. */
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

/** Ingesta de telemetría usada por el endpoint HTTP. */
export const ingestInternal = internalMutation({
  args: {
    deviceId: v.id("devices"),
    values: v.array(v.object({ key: v.string(), value: v.number() })),
    ts: v.number(),
  },
  handler: async (ctx, { deviceId, values, ts }) => {
    for (const { key, value } of values) {
      await ctx.db.insert("telemetry", { deviceId, key, value, ts });
    }
    await ctx.db.patch(deviceId, { lastSeenAt: ts });
  },
});
