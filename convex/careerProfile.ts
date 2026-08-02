import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

// One row per signed-in user: whatever they'd otherwise only have in
// localStorage (resume text, target listing, role, sprint progress),
// synced so it follows them across devices.
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("careerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const save = mutation({
  args: {
    selectedRole: v.string(),
    profile: v.string(),
    listing: v.string(),
    completedDays: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Sign in to save your progress.");
    }

    const existing = await ctx.db
      .query("careerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("careerProfiles", {
        userId,
        ...args,
        updatedAt: Date.now(),
      });
    }
  },
});
