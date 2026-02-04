import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  real,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tag } from "./tag";
import { bountyTierEnum } from "./bounty";

// Extended user profile for recommendation engine
export const userProfile = pgTable(
  "user_profile",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    // Engagement metrics
    totalInteractions: integer("total_interactions").default(0).notNull(),
    engagementScore: real("engagement_score").default(0).notNull(), // 0-100

    // Price preferences (computed from viewing history)
    avgPriceViewed: real("avg_price_viewed").default(0).notNull(),

    // Tier access (from separate scoring system)
    accessTier: bountyTierEnum("access_tier").default("basic").notNull(),

    // GitHub Layer 0 metrics (refreshed weekly)
    githubAccountAge: integer("github_account_age"), // Days
    githubPrAcceptanceRate: real("github_pr_acceptance_rate"),
    githubLanguages: text("github_languages"), // JSON array

    // Platform score (0-10)
    platformScore: real("platform_score").default(2.0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_profile_user_idx").on(table.userId),
    index("user_profile_tier_idx").on(table.accessTier),
    index("user_profile_score_idx").on(table.platformScore),
  ]
);

// User tags (skills/preferences with scores 1-5)
export const userTag = pgTable(
  "user_tag",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    tagId: integer("tag_id")
      .references(() => tag.id, { onDelete: "cascade" })
      .notNull(),
    score: integer("score").notNull(), // 1-5 relevance score
    source: text("source").default("manual").notNull(), // "manual", "inferred", "github"
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_tag_user_idx").on(table.userId),
    index("user_tag_tag_idx").on(table.tagId),
    index("user_tag_score_idx").on(table.score),
  ]
);

// Social graph (mutuals)
export const mutual = pgTable(
  "mutual",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    mutualId: text("mutual_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    layer: integer("layer").default(1).notNull(), // 1 = direct, 2 = friend-of-friend, 3 = 3rd degree
    strength: real("strength").default(1.0).notNull(), // Connection strength (0-1)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("mutual_user_idx").on(table.userId),
    index("mutual_mutual_idx").on(table.mutualId),
    index("mutual_layer_idx").on(table.layer),
  ]
);

// Relations
export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, {
    fields: [userProfile.userId],
    references: [user.id],
  }),
}));

export const userTagRelations = relations(userTag, ({ one }) => ({
  user: one(user, {
    fields: [userTag.userId],
    references: [user.id],
  }),
  tag: one(tag, {
    fields: [userTag.tagId],
    references: [tag.id],
  }),
}));

export const mutualRelations = relations(mutual, ({ one }) => ({
  user: one(user, {
    fields: [mutual.userId],
    references: [user.id],
    relationName: "userMutuals",
  }),
  mutualUser: one(user, {
    fields: [mutual.mutualId],
    references: [user.id],
    relationName: "mutualOfUsers",
  }),
}));
