import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/** Umbrales de alarma por clave de telemetría (estilo ThingsBoard). */
export const thresholdRangeValidator = v.object({
  min: v.optional(v.number()),
  max: v.optional(v.number()),
});

export const thresholdsValidator = v.object({
  temperature: v.optional(thresholdRangeValidator),
  humidity: v.optional(thresholdRangeValidator),
  battery: v.optional(thresholdRangeValidator),
});
export type Thresholds = Infer<typeof thresholdsValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ===== Imind IoT =====

    // Gateways y sensores (BLE Joyway → Gateway → HTTP API)
    devices: defineTable({
      name: v.string(),
      type: v.union(v.literal("gateway"), v.literal("sensor")),
      token: v.string(),
      label: v.optional(v.string()), // ubicación, ej. "Cuarto frío 1"
      lastSeenAt: v.optional(v.number()),
      battery: v.optional(v.number()), // % para sensores BLE
      isDemo: v.optional(v.boolean()),
      thresholds: v.optional(thresholdsValidator),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_token", ["token"])
      .index("by_type", ["type"]),

    // Telemetría: una fila por reporte (compatibilidad con formato ThingsBoard)
    telemetry: defineTable({
      deviceId: v.id("devices"),
      key: v.string(),
      value: v.number(),
      ts: v.number(),
    })
      .index("by_device_ts", ["deviceId", "ts"])
      .index("by_device_key_ts", ["deviceId", "key", "ts"]),

    // Alarmas: se crean al superar umbrales y se cierran al volver al rango
    alarms: defineTable({
      deviceId: v.id("devices"),
      deviceName: v.string(),
      dataKey: v.string(),
      type: v.union(v.literal("max"), v.literal("min")),
      threshold: v.number(),
      value: v.number(),
      severity: v.union(v.literal("critical"), v.literal("warning")),
      status: v.union(
        v.literal("active_unack"),
        v.literal("active_ack"),
        v.literal("cleared_unack"),
        v.literal("cleared_ack"),
      ),
      open: v.boolean(),
      startTs: v.number(),
      endTs: v.optional(v.number()),
      ackTs: v.optional(v.number()),
      ackBy: v.optional(v.id("users")),
    })
      .index("by_ts", ["startTs"])
      .index("by_device", ["deviceId"])
      .index("by_open", ["open"]),

    // Dashboards: documento IMIND v2 en `model` (serializable, fuente de
    // verdad del builder). `widgets` se conserva solo para docs legacy v1.
    dashboards: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      model: v.optional(v.any()),
      widgets: v.optional(v.array(v.any())),
      createdBy: v.optional(v.id("users")),
    }),

    // Eventos de la plataforma (dispositivo creado, telemetría, etc.)
    events: defineTable({
      deviceId: v.optional(v.id("devices")),
      type: v.string(),
      message: v.string(),
      ts: v.number(),
    }).index("by_ts", ["ts"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
