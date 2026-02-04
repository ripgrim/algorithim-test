import { z } from "zod";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../index";
import { db } from "@algorithim-test/db";
import { bounty, bountyTag, bountyView, bountyInteraction } from "@algorithim-test/db/schema/bounty";
import { tag } from "@algorithim-test/db/schema/tag";
import { userProfile, userTag, mutual } from "@algorithim-test/db/schema/user-profile";
import { recommendationLog } from "@algorithim-test/db/schema/recommendation";
import {
  getRecommendations,
  scoreAllBounties,
  getTagMatchDetails,
  type BountyData,
  type MutualConnection,
} from "../services/recommendation";
import {
  trackBehavior,
  getBlendedTagScores,
  getDivergenceAlerts,
  clearDivergence,
  markDivergencePromptShown,
  type InteractionType,
} from "../services/behavior";

export const recommendationRouter = router({
  /**
   * Get personalized recommendations for the current user
   * Returns:
   *   - primary: High relevance bounty matching user's skills
   *   - secondary: "Stretch" bounty to expand skills
   */
  getRecommendations: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // 1. Fetch user profile
    const profile = await db.query.userProfile.findFirst({
      where: eq(userProfile.userId, userId),
    });

    if (!profile) {
      throw new Error("User profile not found. Please complete your profile setup.");
    }

    // 2. Fetch user tags with tag names
    const userTagsWithNames = await db
      .select({
        tagId: userTag.tagId,
        tagName: tag.name,
        score: userTag.score,
      })
      .from(userTag)
      .innerJoin(tag, eq(userTag.tagId, tag.id))
      .where(eq(userTag.userId, userId));

    // 3. Fetch mutuals (layers 1-3)
    const userMutuals = await getMutualsThreeLayers(userId);

    // 4. Fetch all open bounties
    const allBounties = await db
      .select()
      .from(bounty)
      .where(eq(bounty.status, "open"));

    if (allBounties.length === 0) {
      throw new Error("No open bounties available");
    }

    // 5. Fetch bounty tags
    const allBountyTags = await db.select().from(bountyTag);
    const bountyTagMap = new Map<number, { tagId: number; weight: number }[]>();
    for (const bt of allBountyTags) {
      if (!bountyTagMap.has(bt.bountyId)) {
        bountyTagMap.set(bt.bountyId, []);
      }
      bountyTagMap.get(bt.bountyId)!.push({ tagId: bt.tagId, weight: bt.weight });
    }

    // 6. Fetch mutual interactions
    const mutualIds = userMutuals.map((m) => m.mutualId);
    const mutualInteractions = new Map<string, number[]>();

    if (mutualIds.length > 0) {
      const mutualInteractionsRaw = await db
        .select()
        .from(bountyInteraction)
        .where(inArray(bountyInteraction.userId, mutualIds));

      for (const mi of mutualInteractionsRaw) {
        if (!mutualInteractions.has(mi.userId)) {
          mutualInteractions.set(mi.userId, []);
        }
        mutualInteractions.get(mi.userId)!.push(mi.bountyId);
      }
    }

    // 7. Run recommendation algorithm
    const bountyData: BountyData[] = allBounties.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      price: b.price,
      tier: b.tier,
      status: b.status,
      views: b.views,
      submissions: b.submissions,
      likes: b.likes,
      engagementScore: b.engagementScore,
      creatorId: b.creatorId,
      claimedById: b.claimedById,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      expiresAt: b.expiresAt,
      completedAt: b.completedAt,
    }));

    const recommendations = getRecommendations(
      {
        userId,
        userTags: userTagsWithNames,
        userProfile: {
          avgPriceViewed: profile.avgPriceViewed,
          engagementScore: profile.engagementScore,
          accessTier: profile.accessTier,
        },
        mutuals: userMutuals,
      },
      bountyData,
      bountyTagMap,
      mutualInteractions
    );

    // 8. Log recommendations for debugging/analytics
    await db.insert(recommendationLog).values({
      userId,
      primaryBountyId: recommendations.primary.bounty.id,
      secondaryBountyId: recommendations.secondary.bounty.id,
      primaryScore: recommendations.primary.finalScore,
      secondaryScore: recommendations.secondary.finalScore,
      reasonPrimary: JSON.stringify({
        relevance: recommendations.primary.relevanceScore,
        social: recommendations.primary.socialBoost,
        price: recommendations.primary.priceAffinity,
      }),
      reasonSecondary: JSON.stringify({
        relevance: recommendations.secondary.relevanceScore,
        social: recommendations.secondary.socialBoost,
        price: recommendations.secondary.priceAffinity,
      }),
    });

    // 9. Fetch tag names for bounties
    const primaryTags = await getBountyTagNames(recommendations.primary.bounty.id);
    const secondaryTags = await getBountyTagNames(recommendations.secondary.bounty.id);

    return {
      primary: {
        ...recommendations.primary.bounty,
        tags: primaryTags,
        scores: {
          relevance: recommendations.primary.relevanceScore,
          social: recommendations.primary.socialBoost,
          price: recommendations.primary.priceAffinity,
          final: recommendations.primary.finalScore,
        },
      },
      secondary: {
        ...recommendations.secondary.bounty,
        tags: secondaryTags,
        scores: {
          relevance: recommendations.secondary.relevanceScore,
          social: recommendations.secondary.socialBoost,
          price: recommendations.secondary.priceAffinity,
          final: recommendations.secondary.finalScore,
        },
      },
      userProfile: {
        accessTier: profile.accessTier,
        avgPriceViewed: profile.avgPriceViewed,
        engagementScore: profile.engagementScore,
        platformScore: profile.platformScore,
      },
      debug: recommendations.debug,
    };
  }),

  /**
   * Record a bounty view
   * Updates the user's average price viewed (last 10 bounties)
   */
  recordView: protectedProcedure
    .input(z.object({ bountyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // 1. Record the view
      await db.insert(bountyView).values({
        userId,
        bountyId: input.bountyId,
      });

      // 2. Update avg price viewed (last 10)
      const recentViews = await db
        .select({ price: bounty.price })
        .from(bountyView)
        .innerJoin(bounty, eq(bountyView.bountyId, bounty.id))
        .where(eq(bountyView.userId, userId))
        .orderBy(desc(bountyView.viewedAt))
        .limit(10);

      if (recentViews.length > 0) {
        const avgPrice =
          recentViews.reduce((sum, v) => sum + v.price, 0) / recentViews.length;

        await db
          .update(userProfile)
          .set({ avgPriceViewed: avgPrice })
          .where(eq(userProfile.userId, userId));

        return { avgPrice };
      }

      return { avgPrice: 0 };
    }),

  /**
   * Record an interaction (like, submit, claim, complete)
   * Updates user engagement score, bounty metrics, and behavior tracking
   */
  recordInteraction: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        type: z.enum(["view", "like", "submit", "claim", "complete"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // 1. Record interaction
      await db.insert(bountyInteraction).values({
        userId,
        bountyId: input.bountyId,
        type: input.type,
      });

      // 2. Track behavior for implicit profile (only for trackable types)
      const trackableTypes: InteractionType[] = ["view", "like", "submit", "complete"];
      if (trackableTypes.includes(input.type as InteractionType)) {
        await trackBehavior(userId, input.bountyId, input.type as InteractionType);
      }

      // 3. Update engagement score
      const interactionCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bountyInteraction)
        .where(eq(bountyInteraction.userId, userId));

      const interactionCount = interactionCountResult[0]?.count || 0;
      const engagementScore = Math.min(interactionCount * 2, 100);

      await db
        .update(userProfile)
        .set({
          totalInteractions: interactionCount,
          engagementScore,
        })
        .where(eq(userProfile.userId, userId));

      // 4. Update bounty engagement metrics
      if (input.type === "view") {
        await db
          .update(bounty)
          .set({ views: sql`${bounty.views} + 1` })
          .where(eq(bounty.id, input.bountyId));
      } else if (input.type === "like") {
        await db
          .update(bounty)
          .set({ likes: sql`${bounty.likes} + 1` })
          .where(eq(bounty.id, input.bountyId));
      } else if (input.type === "submit") {
        await db
          .update(bounty)
          .set({ submissions: sql`${bounty.submissions} + 1` })
          .where(eq(bounty.id, input.bountyId));
      }

      return { success: true, newEngagementScore: engagementScore };
    }),

  /**
   * Update user tags (skills)
   * Replaces all existing tags with new ones
   */
  updateUserTags: protectedProcedure
    .input(
      z.object({
        tags: z.array(
          z.object({
            tagId: z.number(),
            score: z.number().min(1).max(5),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Delete existing tags
      await db.delete(userTag).where(eq(userTag.userId, userId));

      // Insert new tags
      if (input.tags.length > 0) {
        await db.insert(userTag).values(
          input.tags.map((t) => ({
            userId,
            tagId: t.tagId,
            score: t.score,
            source: "manual" as const,
          }))
        );
      }

      return { success: true, tagCount: input.tags.length };
    }),

  /**
   * Get all available tags
   * Used for tag selection UI
   */
  getTags: protectedProcedure.query(async () => {
    const tags = await db
      .select({
        id: tag.id,
        name: tag.name,
        category: tag.category,
      })
      .from(tag)
      .orderBy(tag.category, tag.name);

    return tags;
  }),

  /**
   * Get user's current tags
   */
  getUserTags: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const tags = await db
      .select({
        tagId: userTag.tagId,
        tagName: tag.name,
        category: tag.category,
        score: userTag.score,
      })
      .from(userTag)
      .innerJoin(tag, eq(userTag.tagId, tag.id))
      .where(eq(userTag.userId, userId));

    return tags;
  }),

  /**
   * Get full bounty feed with scores for all bounties
   * Used for the feed view with filters and debug overlay
   */
  getBountyFeed: protectedProcedure
    .input(
      z.object({
        sortBy: z.enum(["relevance", "price_high", "price_low", "engagement", "newest"]).default("relevance"),
        tierFilter: z.array(z.enum(["basic", "middle", "high"])).optional(),
        tagFilter: z.array(z.number()).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { sortBy = "relevance", tierFilter, tagFilter, limit = 50, offset = 0 } = input || {};

      // 1. Fetch user profile
      const profile = await db.query.userProfile.findFirst({
        where: eq(userProfile.userId, userId),
      });

      if (!profile) {
        throw new Error("User profile not found. Please complete your profile setup.");
      }

      // 2. Fetch user tags with tag names
      const userTagsWithNames = await db
        .select({
          tagId: userTag.tagId,
          tagName: tag.name,
          score: userTag.score,
        })
        .from(userTag)
        .innerJoin(tag, eq(userTag.tagId, tag.id))
        .where(eq(userTag.userId, userId));

      // 3. Fetch mutuals (layers 1-3)
      const userMutuals = await getMutualsThreeLayers(userId);

      // 4. Fetch all open bounties
      let allBounties = await db
        .select()
        .from(bounty)
        .where(eq(bounty.status, "open"));

      // 5. Apply tier filter if provided
      if (tierFilter && tierFilter.length > 0) {
        allBounties = allBounties.filter((b) => tierFilter.includes(b.tier));
      }

      // 6. Fetch bounty tags
      const allBountyTags = await db
        .select({
          bountyId: bountyTag.bountyId,
          tagId: bountyTag.tagId,
          tagName: tag.name,
          weight: bountyTag.weight,
        })
        .from(bountyTag)
        .innerJoin(tag, eq(bountyTag.tagId, tag.id));

      const bountyTagMap = new Map<number, { tagId: number; weight: number }[]>();
      const bountyTagNamesMap = new Map<number, { tagId: number; tagName: string; weight: number }[]>();

      for (const bt of allBountyTags) {
        if (!bountyTagMap.has(bt.bountyId)) {
          bountyTagMap.set(bt.bountyId, []);
          bountyTagNamesMap.set(bt.bountyId, []);
        }
        bountyTagMap.get(bt.bountyId)!.push({ tagId: bt.tagId, weight: bt.weight });
        bountyTagNamesMap.get(bt.bountyId)!.push({ tagId: bt.tagId, tagName: bt.tagName, weight: bt.weight });
      }

      // 7. Apply tag filter if provided
      if (tagFilter && tagFilter.length > 0) {
        allBounties = allBounties.filter((b) => {
          const tags = bountyTagMap.get(b.id) || [];
          return tags.some((t) => tagFilter.includes(t.tagId));
        });
      }

      // 8. Fetch mutual interactions
      const mutualIds = userMutuals.map((m) => m.mutualId);
      const mutualInteractions = new Map<string, number[]>();

      if (mutualIds.length > 0) {
        const mutualInteractionsRaw = await db
          .select()
          .from(bountyInteraction)
          .where(inArray(bountyInteraction.userId, mutualIds));

        for (const mi of mutualInteractionsRaw) {
          if (!mutualInteractions.has(mi.userId)) {
            mutualInteractions.set(mi.userId, []);
          }
          mutualInteractions.get(mi.userId)!.push(mi.bountyId);
        }
      }

      // 9. Convert to BountyData format
      const bountyData: BountyData[] = allBounties.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        price: b.price,
        tier: b.tier,
        status: b.status,
        views: b.views,
        submissions: b.submissions,
        likes: b.likes,
        engagementScore: b.engagementScore,
        creatorId: b.creatorId,
        claimedById: b.claimedById,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        expiresAt: b.expiresAt,
        completedAt: b.completedAt,
      }));

      // 10. Score all bounties
      const scoredBounties = scoreAllBounties(
        {
          userId,
          userTags: userTagsWithNames,
          userProfile: {
            avgPriceViewed: profile.avgPriceViewed,
            engagementScore: profile.engagementScore,
            accessTier: profile.accessTier,
          },
          mutuals: userMutuals,
        },
        bountyData,
        bountyTagMap,
        mutualInteractions
      );

      // 11. Sort based on sortBy parameter
      switch (sortBy) {
        case "relevance":
          scoredBounties.sort((a, b) => b.finalScore - a.finalScore);
          break;
        case "price_high":
          scoredBounties.sort((a, b) => b.bounty.price - a.bounty.price);
          break;
        case "price_low":
          scoredBounties.sort((a, b) => a.bounty.price - b.bounty.price);
          break;
        case "engagement":
          scoredBounties.sort((a, b) => b.bounty.engagementScore - a.bounty.engagementScore);
          break;
        case "newest":
          scoredBounties.sort((a, b) => b.bounty.createdAt.getTime() - a.bounty.createdAt.getTime());
          break;
      }

      // 12. Apply pagination
      const total = scoredBounties.length;
      const paginatedBounties = scoredBounties.slice(offset, offset + limit);

      // 13. Add tag details for each bounty (for debug overlay)
      const bountiesWithDetails = paginatedBounties.map((sb) => {
        const bountyTagsWithNames = bountyTagNamesMap.get(sb.bounty.id) || [];
        const tagMatchDetails = getTagMatchDetails(userTagsWithNames, bountyTagsWithNames);

        return {
          ...sb.bounty,
          tags: bountyTagsWithNames.map((t) => ({ name: t.tagName, weight: t.weight })),
          scores: {
            relevance: sb.relevanceScore,
            social: sb.socialBoost,
            price: sb.priceAffinity,
            final: sb.finalScore,
          },
          debug: {
            tagMatches: tagMatchDetails,
            priceRatio: profile.avgPriceViewed > 0 
              ? sb.bounty.price / profile.avgPriceViewed 
              : null,
            mutualCount: userMutuals.length,
          },
        };
      });

      return {
        bounties: bountiesWithDetails,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        userProfile: {
          accessTier: profile.accessTier,
          avgPriceViewed: profile.avgPriceViewed,
          engagementScore: profile.engagementScore,
          platformScore: profile.platformScore,
        },
        userTags: userTagsWithNames,
      };
    }),

  /**
   * Get user profile
   */
  getUserProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const profile = await db.query.userProfile.findFirst({
      where: eq(userProfile.userId, userId),
    });

    if (!profile) {
      return null;
    }

    return {
      accessTier: profile.accessTier,
      avgPriceViewed: profile.avgPriceViewed,
      engagementScore: profile.engagementScore,
      platformScore: profile.platformScore,
      totalInteractions: profile.totalInteractions,
    };
  }),

  /**
   * Get blended tag scores (explicit + implicit)
   */
  getBlendedTags: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return getBlendedTagScores(userId);
  }),

  /**
   * Get divergence alerts ("are you sure?" prompts)
   */
  getDivergenceAlerts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return getDivergenceAlerts(userId);
  }),

  /**
   * Update the user's profile settings (debug tool)
   * Allows manual adjustment of profile fields for testing recommendations
   */
  updateDebugProfile: protectedProcedure
    .input(
      z.object({
        avgPriceViewed: z.number().min(0).max(50000).optional(),
        accessTier: z.enum(["basic", "middle", "high"]).optional(),
        platformScore: z.number().min(0).max(10).optional(),
        engagementScore: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const updateData: Partial<{
        avgPriceViewed: number;
        accessTier: "basic" | "middle" | "high";
        platformScore: number;
        engagementScore: number;
      }> = {};

      if (input.avgPriceViewed !== undefined) {
        updateData.avgPriceViewed = input.avgPriceViewed;
      }
      if (input.accessTier !== undefined) {
        updateData.accessTier = input.accessTier;
      }
      if (input.platformScore !== undefined) {
        updateData.platformScore = input.platformScore;
      }
      if (input.engagementScore !== undefined) {
        updateData.engagementScore = input.engagementScore;
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(userProfile)
          .set(updateData)
          .where(eq(userProfile.userId, userId));
      }

      return { success: true, updated: updateData };
    }),

  /**
   * Respond to a divergence alert
   */
  respondToDivergence: protectedProcedure
    .input(
      z.object({
        tagId: z.number(),
        action: z.enum(["add_skill", "remove_skill", "keep", "dismiss"]),
        newScore: z.number().min(1).max(5).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (input.action === "add_skill" && input.newScore) {
        // Add the tag to user's explicit profile
        await db.insert(userTag).values({
          userId,
          tagId: input.tagId,
          score: input.newScore,
          source: "divergence_prompt",
        });
      } else if (input.action === "remove_skill") {
        // Remove the tag from user's explicit profile
        await db
          .delete(userTag)
          .where(and(eq(userTag.userId, userId), eq(userTag.tagId, input.tagId)));
      }

      // Clear the divergence flag
      await clearDivergence(userId, input.tagId);

      // Mark prompt as shown
      await markDivergencePromptShown(userId);

      return { success: true };
    }),
});

// ============ HELPER FUNCTIONS ============

/**
 * Get mutuals up to 3 layers deep
 * Layer 1: Direct mutuals
 * Layer 2: Mutuals of mutuals
 * Layer 3: 3rd degree connections
 */
async function getMutualsThreeLayers(userId: string): Promise<MutualConnection[]> {
  // Layer 1: Direct mutuals
  const layer1 = await db.select().from(mutual).where(eq(mutual.userId, userId));

  if (layer1.length === 0) {
    return [];
  }

  const layer1Ids = layer1.map((m) => m.mutualId);
  const result: MutualConnection[] = layer1.map((m) => ({
    mutualId: m.mutualId,
    layer: 1 as const,
    strength: m.strength,
  }));

  // Layer 2: Mutuals of mutuals
  const layer2Raw = await db
    .select()
    .from(mutual)
    .where(
      and(
        inArray(mutual.userId, layer1Ids),
        sql`${mutual.mutualId} != ${userId}`
      )
    );

  const layer2Ids = new Set<string>();
  for (const m of layer2Raw) {
    // Skip if already in layer 1
    if (!layer1Ids.includes(m.mutualId) && m.mutualId !== userId) {
      layer2Ids.add(m.mutualId);
      result.push({
        mutualId: m.mutualId,
        layer: 2 as const,
        strength: m.strength * 0.5, // Decay strength for layer 2
      });
    }
  }

  // Layer 3: Mutuals of layer 2
  if (layer2Ids.size > 0) {
    const layer3Raw = await db
      .select()
      .from(mutual)
      .where(
        and(
          inArray(mutual.userId, Array.from(layer2Ids)),
          sql`${mutual.mutualId} != ${userId}`
        )
      );

    for (const m of layer3Raw) {
      // Skip if already in layer 1 or 2
      if (!layer1Ids.includes(m.mutualId) && !layer2Ids.has(m.mutualId) && m.mutualId !== userId) {
        result.push({
          mutualId: m.mutualId,
          layer: 3 as const,
          strength: m.strength * 0.25, // Decay strength for layer 3
        });
      }
    }
  }

  return result;
}

/**
 * Get tag names for a bounty
 */
async function getBountyTagNames(
  bountyId: number
): Promise<{ name: string; weight: number }[]> {
  return db
    .select({ name: tag.name, weight: bountyTag.weight })
    .from(bountyTag)
    .innerJoin(tag, eq(bountyTag.tagId, tag.id))
    .where(eq(bountyTag.bountyId, bountyId));
}
