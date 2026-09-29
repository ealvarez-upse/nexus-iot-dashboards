import { query } from "./_generated/server";

/** Eventos recientes de la plataforma. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("events")
      .withIndex("by_ts")
      .order("desc")
      .take(15);
  },
});
