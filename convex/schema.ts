import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  careerProfiles: defineTable({
    userId: v.id("users"),
    selectedRole: v.string(),
    profile: v.string(),
    listing: v.string(),
    completedDays: v.array(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
