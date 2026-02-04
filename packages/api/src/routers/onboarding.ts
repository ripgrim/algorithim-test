import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../index";
import { db } from "@algorithim-test/db";
import { tag } from "@algorithim-test/db/schema/tag";
import { userTag } from "@algorithim-test/db/schema/user-profile";
import {
  userOnboarding,
  userBlendConfig,
  userBehaviorPrice,
} from "@algorithim-test/db/schema/onboarding";

export const onboardingRouter = router({
  /**
   * Get onboarding status for current user
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const onboarding = await db.query.userOnboarding.findFirst({
      where: eq(userOnboarding.userId, userId),
    });

    if (!onboarding) {
      return {
        started: false,
        completed: false,
        currentStep: 1,
      };
    }

    return {
      started: true,
      completed: !!onboarding.completedAt,
      currentStep: onboarding.currentStep,
      data: onboarding,
    };
  }),

  /**
   * Initialize onboarding for a new user
   */
  initialize: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Check if already exists
    const existing = await db.query.userOnboarding.findFirst({
      where: eq(userOnboarding.userId, userId),
    });

    if (existing) {
      return { success: true, onboardingId: existing.id };
    }

    // Create onboarding record
    const result = await db
      .insert(userOnboarding)
      .values({ userId, currentStep: 1 })
      .returning();

    const onboarding = result[0];
    if (!onboarding) {
      throw new Error("Failed to create onboarding record");
    }

    // Create blend config with default weights (80% explicit, 20% implicit)
    await db.insert(userBlendConfig).values({ userId });

    // Create behavior price tracker
    await db.insert(userBehaviorPrice).values({ userId });

    return { success: true, onboardingId: onboarding.id };
  }),

  /**
   * Get all available tags grouped by category
   */
  getTags: protectedProcedure.query(async () => {
    const allTags = await db.select().from(tag).orderBy(tag.category, tag.name);

    // Group by category
    const grouped: Record<string, { id: number; name: string }[]> = {};
    for (const t of allTags) {
      if (!grouped[t.category]) {
        grouped[t.category] = [];
      }
      grouped[t.category]!.push({ id: t.id, name: t.name });
    }

    return grouped;
  }),

  /**
   * Save Step 1: Skills
   */
  saveSkills: protectedProcedure
    .input(
      z.object({
        skills: z.array(
          z.object({
            tagId: z.number(),
            score: z.number().min(1).max(5),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Delete existing user tags from onboarding
      await db.delete(userTag).where(eq(userTag.userId, userId));

      // Insert new tags
      if (input.skills.length > 0) {
        await db.insert(userTag).values(
          input.skills.map((s) => ({
            userId,
            tagId: s.tagId,
            score: s.score,
            source: "onboarding" as const,
          }))
        );
      }

      // Update onboarding step
      await db
        .update(userOnboarding)
        .set({ currentStep: 2 })
        .where(eq(userOnboarding.userId, userId));

      return { success: true, nextStep: 2 };
    }),

  /**
   * Save Step 2: Work Life
   */
  saveWorkLife: protectedProcedure
    .input(
      z.object({
        timeCommitment: z.enum(["side_hustle", "part_time", "full_time"]),
        timezonePreference: z.enum(["async_only", "some_overlap", "flexible"]),
        deadlineStyle: z.enum(["quick", "standard", "long_term"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db
        .update(userOnboarding)
        .set({
          timeCommitment: input.timeCommitment,
          timezonePreference: input.timezonePreference,
          deadlineStyle: input.deadlineStyle,
          currentStep: 3,
        })
        .where(eq(userOnboarding.userId, userId));

      return { success: true, nextStep: 3 };
    }),

  /**
   * Save Step 3: Tech Stack
   */
  saveTechStack: protectedProcedure
    .input(
      z.object({
        techStack: z.object({
          frontend: z.array(z.string()).optional(),
          backend: z.array(z.string()).optional(),
          database: z.array(z.string()).optional(),
          infra: z.array(z.string()).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db
        .update(userOnboarding)
        .set({
          techStack: input.techStack,
          currentStep: 4,
        })
        .where(eq(userOnboarding.userId, userId));

      return { success: true, nextStep: 4 };
    }),

  /**
   * Save Step 4: Preferences & Complete Onboarding
   */
  savePreferences: protectedProcedure
    .input(
      z.object({
        priceRangeMin: z.number().min(10).max(10000),
        priceRangeMax: z.number().min(10).max(10000),
        bountyTypes: z.array(z.string()),
        riskTolerance: z.enum(["safe", "balanced", "adventurous"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db
        .update(userOnboarding)
        .set({
          priceRangeMin: input.priceRangeMin,
          priceRangeMax: input.priceRangeMax,
          bountyTypes: input.bountyTypes,
          riskTolerance: input.riskTolerance,
          currentStep: 5,
          completedAt: new Date(),
        })
        .where(eq(userOnboarding.userId, userId));

      // Store explicit price preferences for divergence detection
      await db
        .update(userBehaviorPrice)
        .set({
          lastExplicitMin: input.priceRangeMin,
          lastExplicitMax: input.priceRangeMax,
        })
        .where(eq(userBehaviorPrice.userId, userId));

      return { success: true, completed: true };
    }),

  /**
   * Go back to a previous step
   */
  goToStep: protectedProcedure
    .input(z.object({ step: z.number().min(1).max(4) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db
        .update(userOnboarding)
        .set({ currentStep: input.step })
        .where(eq(userOnboarding.userId, userId));

      return { success: true, currentStep: input.step };
    }),
});
