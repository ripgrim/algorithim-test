import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  real,
  boolean,
  pgEnum,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ============ ENUMS ============

export const timeCommitmentEnum = pgEnum("time_commitment", [
  "side_hustle",    // < 10 hrs/week
  "part_time",      // 10-20 hrs/week
  "full_time",      // 20+ hrs/week
]);

export const timezonePreferenceEnum = pgEnum("timezone_preference", [
  "async_only",
  "some_overlap",
  "flexible",
]);

export const deadlineStyleEnum = pgEnum("deadline_style", [
  "quick",          // < 1 week
  "standard",       // 1-4 weeks
  "long_term",      // 4+ weeks
]);

export const riskToleranceEnum = pgEnum("risk_tolerance", [
  "safe",           // established clients, clear specs
  "balanced",
  "adventurous",    // new clients, vague specs, higher pay
]);

// ============ ONBOARDING (Explicit Profile) ============

export const userOnboarding = pgTable(
  "user_onboarding",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    // Step 1: Skills - stored in userTag table with source="onboarding"

    // Step 2: Work Life
    timeCommitment: timeCommitmentEnum("time_commitment"),
    timezonePreference: timezonePreferenceEnum("timezone_preference"),
    deadlineStyle: deadlineStyleEnum("deadline_style"),

    // Step 3: Tech Stack - stored as JSON for flexibility
    // { frontend: ["react", "vue"], backend: ["node"], database: ["postgres"], infra: ["aws"] }
    techStack: jsonb("tech_stack").$type<{
      frontend?: string[];
      backend?: string[];
      database?: string[];
      infra?: string[];
    }>(),

    // Step 4: Preferences
    priceRangeMin: integer("price_range_min").default(100),
    priceRangeMax: integer("price_range_max").default(5000),
    bountyTypes: jsonb("bounty_types").$type<string[]>(), // ["bug_fix", "feature", "full_project", "code_review", "docs"]
    riskTolerance: riskToleranceEnum("risk_tolerance"),

    // Onboarding state
    completedAt: timestamp("completed_at"),
    currentStep: integer("current_step").default(1).notNull(), // 1-4, or 5 = complete

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_onboarding_user_idx").on(table.userId),
    index("user_onboarding_completed_idx").on(table.completedAt),
  ]
);

// ============ BEHAVIOR TRACKING (Implicit Profile) ============

// Tracks inferred tag scores from user behavior
// This is separate from userTag which stores explicit (user-set) scores
export const userBehaviorTag = pgTable(
  "user_behavior_tag",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    tagId: integer("tag_id").notNull(),

    // Behavior signals (each 0-100, weighted differently)
    viewCount: integer("view_count").default(0).notNull(),
    viewScore: real("view_score").default(0).notNull(),        // Normalized 0-10

    likeCount: integer("like_count").default(0).notNull(),
    likeScore: real("like_score").default(0).notNull(),        // Normalized 0-10

    submitCount: integer("submit_count").default(0).notNull(),
    submitScore: real("submit_score").default(0).notNull(),    // Normalized 0-10

    completeCount: integer("complete_count").default(0).notNull(),
    completeScore: real("complete_score").default(0).notNull(), // Normalized 0-10

    // Computed implicit score (weighted combination of above)
    // Formula: views*0.1 + likes*0.2 + submits*0.3 + completes*0.4
    implicitScore: real("implicit_score").default(0).notNull(), // 0-10

    // For divergence detection
    lastExplicitScore: real("last_explicit_score"),  // What user said they were
    divergenceDetected: boolean("divergence_detected").default(false),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_behavior_tag_user_idx").on(table.userId),
    index("user_behavior_tag_tag_idx").on(table.tagId),
    index("user_behavior_tag_implicit_idx").on(table.implicitScore),
    index("user_behavior_tag_divergence_idx").on(table.divergenceDetected),
  ]
);

// Tracks price behavior over time
export const userBehaviorPrice = pgTable(
  "user_behavior_price",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    // Rolling averages (last 50 interactions each)
    avgPriceViewed: real("avg_price_viewed").default(0).notNull(),
    avgPriceLiked: real("avg_price_liked").default(0).notNull(),
    avgPriceSubmitted: real("avg_price_submitted").default(0).notNull(),
    avgPriceCompleted: real("avg_price_completed").default(0).notNull(),

    // Computed preferred price range (from behavior)
    implicitPriceMin: real("implicit_price_min"),
    implicitPriceMax: real("implicit_price_max"),

    // For divergence detection
    lastExplicitMin: real("last_explicit_min"),
    lastExplicitMax: real("last_explicit_max"),
    divergenceDetected: boolean("divergence_detected").default(false),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_behavior_price_user_idx").on(table.userId),
  ]
);

// ============ BLENDING CONFIG ============

// Per-user config for how much to trust explicit vs implicit
export const userBlendConfig = pgTable(
  "user_blend_config",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    // Blend weights (sum to 1.0)
    // New users: explicitWeight=0.8, implicitWeight=0.2
    // As behavior data accumulates, this shifts toward implicit
    explicitWeight: real("explicit_weight").default(0.8).notNull(),
    implicitWeight: real("implicit_weight").default(0.2).notNull(),

    // Total interactions used to calculate blend shift
    totalInteractions: integer("total_interactions").default(0).notNull(),

    // Thresholds for "are you sure?" prompts
    divergenceThreshold: real("divergence_threshold").default(3.0).notNull(), // Score difference to trigger
    lastDivergencePrompt: timestamp("last_divergence_prompt"),
    divergencePromptCount: integer("divergence_prompt_count").default(0).notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_blend_config_user_idx").on(table.userId),
  ]
);

// ============ RELATIONS ============

export const userOnboardingRelations = relations(userOnboarding, ({ one }) => ({
  user: one(user, {
    fields: [userOnboarding.userId],
    references: [user.id],
  }),
}));

export const userBehaviorTagRelations = relations(userBehaviorTag, ({ one }) => ({
  user: one(user, {
    fields: [userBehaviorTag.userId],
    references: [user.id],
  }),
}));

export const userBehaviorPriceRelations = relations(userBehaviorPrice, ({ one }) => ({
  user: one(user, {
    fields: [userBehaviorPrice.userId],
    references: [user.id],
  }),
}));

export const userBlendConfigRelations = relations(userBlendConfig, ({ one }) => ({
  user: one(user, {
    fields: [userBlendConfig.userId],
    references: [user.id],
  }),
}));
