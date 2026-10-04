import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

/** Eventos recientes de la plataforma (solo lectura autenticada; se muestran en el Resumen). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("events")
      .withIndex("by_ts")
      .order("desc")
      .take(15);
  },
});
