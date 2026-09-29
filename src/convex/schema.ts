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

    // ===== Nexus IoT =====

    // Gateways y sensores (BLE Joyway → Gateway → HTTP API)
    devices: defineTable({
      name: v.string(),
      type: v.union(v.literal("gateway"), v.literal("sensor")),
      token: v.string(),
      label: v.optional(v.string()), // ubicación, ej. "Cuarto frío 1"
      lastSeenAt: v.optional(v.number()),
      battery: v.optional(v.number()), // % para sensores BLE
      isDemo: v.optional(v.boolean()),
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

    // Dashboards con layout y widgets persistentes
    dashboards: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      widgets: v.array(
        v.object({
          id: v.string(),
          type: v.union(
            v.literal("timeSeries"),
            v.literal("valueCard"),
            v.literal("gauge"),
          ),
          title: v.string(),
          deviceId: v.id("devices"),
          dataKey: v.string(),
          unit: v.optional(v.string()),
          color: v.optional(v.string()),
          width: v.union(
            v.literal("1/3"),
            v.literal("1/2"),
            v.literal("2/3"),
            v.literal("1"),
          ),
        }),
      ),
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
