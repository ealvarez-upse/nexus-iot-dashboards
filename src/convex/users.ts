import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ROLES } from "./schema";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.users.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/** Cuenta usuarios registrados (para saber si el primero se vuelve admin). */
export const countUsers = query({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query("users").collect()).length;
  },
});

/** Promueve al primer usuario registrado a admin automáticamente. */
export const promoteFirstUser = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const users = await ctx.db.query("users").collect();
    if (users.length > 1) return null;
    const user = await ctx.db.get(userId);
    if (user && user.role !== ROLES.ADMIN) {
      await ctx.db.patch(userId, { role: ROLES.ADMIN });
    }
    return ROLES.ADMIN;
  },
});

/** Lista usuarios para la página de administración (solo admin). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || me.role !== ROLES.ADMIN) return null;
    return await ctx.db
      .query("users")
      .order("desc")
      .collect();
  },
});

/** Cambia el rol de un usuario (solo admin; no puede degradarse a sí mismo). */
export const setRole = mutation({
  args: { userId: v.id("users"), role: v.string() },
  handler: async (ctx, { userId, role }) => {
    const myId = await getAuthUserId(ctx);
    if (myId === null) throw new Error("No autenticado");
    const me = await ctx.db.get(myId);
    if (!me || me.role !== ROLES.ADMIN) throw new Error("Requiere admin");
    if (role !== ROLES.ADMIN && role !== ROLES.USER && role !== ROLES.MEMBER) {
      throw new Error("Rol inválido");
    }
    if (myId === userId) throw new Error("No puedes cambiar tu propio rol");
    await ctx.db.patch(userId, { role });
  },
});
