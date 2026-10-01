import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const widgetValidator = v.object({
  id: v.string(),
  type: v.union(
    v.literal("timeSeries"),
    v.literal("valueCard"),
    v.literal("gauge"),
    v.literal("battery"),
    v.literal("alarms"),
  ),
  title: v.string(),
  deviceId: v.id("devices"),
  dataKey: v.string(),
  unit: v.optional(v.string()),
  color: v.optional(v.string()),
  width: v.union(v.literal("1/3"), v.literal("1/2"), v.literal("2/3"), v.literal("1")),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("dashboards").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("dashboards") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    widgets: v.optional(v.array(widgetValidator)),
  },
  handler: async (ctx, { name, description, widgets }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    return await ctx.db.insert("dashboards", {
      name,
      description,
      widgets: widgets ?? [],
      createdBy: userId,
    });
  },
});

export const rename = mutation({
  args: { id: v.id("dashboards"), name: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, { id, name, description }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    await ctx.db.patch(id, { name, description });
  },
});

export const setWidgets = mutation({
  args: { id: v.id("dashboards"), widgets: v.array(widgetValidator) },
  handler: async (ctx, { id, widgets }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    await ctx.db.patch(id, { widgets });
  },
});

export const remove = mutation({
  args: { id: v.id("dashboards") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    await ctx.db.delete(id);
  },
});
