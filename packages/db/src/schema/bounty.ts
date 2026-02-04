import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  real,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tag } from "./tag";

// Enums
export const bountyTierEnum = pgEnum("bounty_tier", ["basic", "middle", "high"]);
export const bountyStatusEnum = pgEnum("bounty_status", [
  "open",
  "claimed",
  "completed",
  "expired",
]);

// Bounties table
export const bounty = pgTable(
  "bounty",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    price: integer("price").notNull(), // In USD
    tier: bountyTierEnum("tier").notNull(),
    status: bountyStatusEnum("status").default("open").notNull(),

    // Engagement metrics
    views: integer("views").default(0).notNull(),
    submissions: integer("submissions").default(0).notNull(),
    likes: integer("likes").default(0).notNull(),
    engagementScore: real("engagement_score").default(0).notNull(), // Computed 0-100

    // Ownership
    creatorId: text("creator_id").references(() => user.id, { onDelete: "set null" }),
    claimedById: text("claimed_by_id").references(() => user.id, { onDelete: "set null" }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("bounty_tier_idx").on(table.tier),
    index("bounty_status_idx").on(table.status),
    index("bounty_creator_idx").on(table.creatorId),
    index("bounty_price_idx").on(table.price),
    index("bounty_engagement_idx").on(table.engagementScore),
  ]
);

// Bounty-Tag junction table
export const bountyTag = pgTable(
  "bounty_tag",
  {
    id: serial("id").primaryKey(),
    bountyId: integer("bounty_id")
      .references(() => bounty.id, { onDelete: "cascade" })
      .notNull(),
    tagId: integer("tag_id")
      .references(() => tag.id, { onDelete: "cascade" })
      .notNull(),
    weight: real("weight").default(1.0).notNull(), // How relevant this tag is (0-1)
  },
  (table) => [
    index("bounty_tag_bounty_idx").on(table.bountyId),
    index("bounty_tag_tag_idx").on(table.tagId),
  ]
);

// Bounty views (for avg price calculation)
export const bountyView = pgTable(
  "bounty_view",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    bountyId: integer("bounty_id")
      .references(() => bounty.id, { onDelete: "cascade" })
      .notNull(),
    viewedAt: timestamp("viewed_at").defaultNow().notNull(),
    duration: integer("duration"), // Seconds spent viewing
  },
  (table) => [
    index("bounty_view_user_idx").on(table.userId),
    index("bounty_view_bounty_idx").on(table.bountyId),
    index("bounty_view_time_idx").on(table.viewedAt),
  ]
);

// User interactions with bounties (for engagement score)
export const bountyInteraction = pgTable(
  "bounty_interaction",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    bountyId: integer("bounty_id")
      .references(() => bounty.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(), // "view", "like", "submit", "claim", "complete"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("bounty_interaction_user_idx").on(table.userId),
    index("bounty_interaction_bounty_idx").on(table.bountyId),
    index("bounty_interaction_type_idx").on(table.type),
  ]
);

// Relations
export const bountyRelations = relations(bounty, ({ one, many }) => ({
  creator: one(user, {
    fields: [bounty.creatorId],
    references: [user.id],
    relationName: "createdBounties",
  }),
  claimedBy: one(user, {
    fields: [bounty.claimedById],
    references: [user.id],
    relationName: "claimedBounties",
  }),
  tags: many(bountyTag),
  views: many(bountyView),
  interactions: many(bountyInteraction),
}));

export const bountyTagRelations = relations(bountyTag, ({ one }) => ({
  bounty: one(bounty, {
    fields: [bountyTag.bountyId],
    references: [bounty.id],
  }),
  tag: one(tag, {
    fields: [bountyTag.tagId],
    references: [tag.id],
  }),
}));

export const bountyViewRelations = relations(bountyView, ({ one }) => ({
  user: one(user, {
    fields: [bountyView.userId],
    references: [user.id],
  }),
  bounty: one(bounty, {
    fields: [bountyView.bountyId],
    references: [bounty.id],
  }),
}));

export const bountyInteractionRelations = relations(bountyInteraction, ({ one }) => ({
  user: one(user, {
    fields: [bountyInteraction.userId],
    references: [user.id],
  }),
  bounty: one(bounty, {
    fields: [bountyInteraction.bountyId],
    references: [bounty.id],
  }),
}));
