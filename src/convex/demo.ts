import { internalMutation, mutation } from "./_generated/server";

/** Crea datos demo la primera vez: gateway + sensor BLE con 24 h de historial. */
export const ensureDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    // No repetir el seed si ya se hizo antes
    const seeded = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("type"), "demo.seeded"))
      .first();
    if (seeded) return;

    const gatewayId = await ctx.db.insert("devices", {
      name: "Gateway Demo · JW1602G4",
      type: "gateway",
      label: "Oficina central",
      token: crypto.randomUUID().replace(/-/g, ""),
      isDemo: true,
    });
    void gatewayId;

    const sensorId = await ctx.db.insert("devices", {
      name: "Sensor BLE Demo · JW1407HT",
      type: "sensor",
      label: "Cuarto frío 1",
      token: crypto.randomUUID().replace(/-/g, ""),
      battery: 87,
      isDemo: true,
    });

    const now = Date.now();
    for (let i = 288; i > 0; i--) {
      const ts = now - i * 5 * 60 * 1000;
      const temp = +(4 + 1.6 * Math.sin((i / 96) * Math.PI * 2) + (Math.random() - 0.5) * 0.4).toFixed(2);
      const hum = +(62 + 6 * Math.sin((i / 120) * Math.PI * 2 + 1) + (Math.random() - 0.5) * 2).toFixed(1);
      await ctx.db.insert("telemetry", { deviceId: sensorId, key: "temperature", value: temp, ts });
      await ctx.db.insert("telemetry", { deviceId: sensorId, key: "humidity", value: hum, ts });
      if (i % 48 === 0) {
        await ctx.db.insert("telemetry", { deviceId: sensorId, key: "battery", value: 88 - Math.floor((288 - i) / 96), ts });
      }
    }

    await ctx.db.insert("dashboards", {
      name: "Cuarto Frío · Temperatura y Humedad",
      description: "Dashboard demo con telemetría simulada de un sensor BLE Joyway JW1407HT.",
      widgets: [
        { id: "w1", type: "valueCard", title: "Temperatura actual", deviceId: sensorId, dataKey: "temperature", unit: "°C", color: "#0891b2", width: "1/3" },
        { id: "w2", type: "valueCard", title: "Humedad actual", deviceId: sensorId, dataKey: "humidity", unit: "%", color: "#0d9488", width: "1/3" },
        { id: "w3", type: "valueCard", title: "Batería del sensor", deviceId: sensorId, dataKey: "battery", unit: "%", color: "#ca8a04", width: "1/3" },
        { id: "w4", type: "timeSeries", title: "Temperatura · últimas 24 h", deviceId: sensorId, dataKey: "temperature", unit: "°C", color: "#0891b2", width: "2/3" },
        { id: "w5", type: "gauge", title: "Humedad relativa", deviceId: sensorId, dataKey: "humidity", unit: "%", color: "#0d9488", width: "1/3" },
      ],
    });

    await ctx.db.insert("events", {
      type: "demo.seeded",
      message: "Datos demo creados: sensor BLE + gateway con 24 h de historial",
      ts: now,
    });
  },
});

/** Tick de simulación: los sensores demo emiten una lectura cada minuto. */
export const simulateTick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const demoSensors = await ctx.db
      .query("devices")
      .withIndex("by_type", (q) => q.eq("type", "sensor"))
      .filter((q) => q.eq(q.field("isDemo"), true))
      .collect();

    const now = Date.now();
    const minutes = Math.floor(now / 60000);

    for (const sensor of demoSensors) {
      const temp = +(4 + 1.6 * Math.sin((minutes / 96) * Math.PI * 2) + (Math.random() - 0.5) * 0.35).toFixed(2);
      const hum = +(62 + 6 * Math.sin((minutes / 120) * Math.PI * 2 + 1) + (Math.random() - 0.5) * 1.6).toFixed(1);
      await ctx.db.insert("telemetry", { deviceId: sensor._id, key: "temperature", value: temp, ts: now });
      await ctx.db.insert("telemetry", { deviceId: sensor._id, key: "humidity", value: hum, ts: now });
      if (minutes % 15 === 0) {
        const last = await ctx.db
          .query("telemetry")
          .withIndex("by_device_key_ts", (q) => q.eq("deviceId", sensor._id).eq("key", "battery"))
          .order("desc")
          .first();
        await ctx.db.insert("telemetry", {
          deviceId: sensor._id,
          key: "battery",
          value: Math.max(35, (last?.value ?? 87) - 0.05),
          ts: now,
        });
      }
      await ctx.db.patch(sensor._id, { lastSeenAt: now, battery: Math.max(35, 87 - Math.floor((now % 86400000) / 3600000) * 0.05) });
    }
  },
});
