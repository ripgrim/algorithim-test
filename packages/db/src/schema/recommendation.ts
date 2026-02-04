import { pgTable, text, serial, integer, timestamp, real, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { bounty } from "./bounty";

// Recommendation log for tracking/debugging/analytics
export const recommendationLog = pgTable(
  "recommendation_log",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    
    // Recommended bounties
    primaryBountyId: integer("primary_bounty_id").references(() => bounty.id, {
      onDelete: "set null",
    }),
    secondaryBountyId: integer("secondary_bounty_id").references(() => bounty.id, {
      onDelete: "set null",
    }),
    
    // Scores for debugging
    primaryScore: real("primary_score"),
    secondaryScore: real("secondary_score"),
    
    // JSON explanations
    reasonPrimary: text("reason_primary"), // JSON: { relevance, social, price }
    reasonSecondary: text("reason_secondary"),
    
    // Metadata
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("recommendation_log_user_idx").on(table.userId),
    index("recommendation_log_time_idx").on(table.createdAt),
    index("recommendation_log_primary_idx").on(table.primaryBountyId),
    index("recommendation_log_secondary_idx").on(table.secondaryBountyId),
  ]
);

// Relations
export const recommendationLogRelations = relations(recommendationLog, ({ one }) => ({
  user: one(user, {
    fields: [recommendationLog.userId],
    references: [user.id],
  }),
  primaryBounty: one(bounty, {
    fields: [recommendationLog.primaryBountyId],
    references: [bounty.id],
    relationName: "primaryRecommendations",
  }),
  secondaryBounty: one(bounty, {
    fields: [recommendationLog.secondaryBountyId],
    references: [bounty.id],
    relationName: "secondaryRecommendations",
  }),
}));
