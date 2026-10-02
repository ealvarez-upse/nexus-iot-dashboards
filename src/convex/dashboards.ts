import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";

/**
 * Dashboards como documentos IMIND v2 (`model`).
 * Autorización: solo el creador o un admin puede modificar/eliminar.
 * Documentos legacy sin `createdBy`: solo admin (el seed demo pertenece a la plataforma).
 */
async function requireEditAccess(ctx: MutationCtx, id: Id<"dashboards">) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("No autenticado");
  const user = await ctx.db.get(userId);
  const doc = await ctx.db.get(id);
  if (!doc) throw new Error("Dashboard no encontrado");
  const isOwner = doc.createdBy !== undefined && doc.createdBy === userId;
  const isAdmin = user?.role === "admin";
  if (!isOwner && !isAdmin) {
    throw new Error("Sin permisos para modificar este dashboard");
  }
  return { doc, userId, isAdmin };
}

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

/** Crea un dashboard vacío en formato v2. */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { name, description }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    return await ctx.db.insert("dashboards", {
      name,
      description,
      createdBy: userId,
      model: {
        schemaVersion: 2,
        metadata: { name, description },
        settings: { columns: 12, rowHeight: 80, margin: 12 },
        widgets: [],
        datasources: [],
        actions: [],
      },
    });
  },
});

/** Guarda el documento completo del dashboard (draft local → persistencia). */
export const save = mutation({
  args: {
    id: v.id("dashboards"),
    name: v.string(),
    description: v.optional(v.string()),
    model: v.any(),
  },
  handler: async (ctx, { id, name, description, model }) => {
    await requireEditAccess(ctx, id);
    await ctx.db.patch(id, { name, description, model });
  },
});

export const remove = mutation({
  args: { id: v.id("dashboards") },
  handler: async (ctx, { id }) => {
    await requireEditAccess(ctx, id);
    await ctx.db.delete(id);
  },
});
