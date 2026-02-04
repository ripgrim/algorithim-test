/**
 * Behavior Tracking Service
 * 
 * Tracks user behavior (views, likes, submits, completes) and computes
 * implicit profile scores that blend with explicit (onboarding) data.
 * 
 * Signal Weights:
 *   - Views: 10% (shows interest, could be browsing)
 *   - Likes: 20% (light commitment)
 *   - Submits: 30% (real commitment)
 *   - Completes: 40% (actual proof of fit)
 */

import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@algorithim-test/db";
import {
  userBehaviorTag,
  userBehaviorPrice,
  userBlendConfig,
} from "@algorithim-test/db/schema/onboarding";
import { bounty, bountyTag } from "@algorithim-test/db/schema/bounty";
import { tag } from "@algorithim-test/db/schema/tag";
import { userTag } from "@algorithim-test/db/schema/user-profile";

// ============ CONSTANTS ============

const BEHAVIOR_WEIGHTS = {
  view: 0.1,
  like: 0.2,
  submit: 0.3,
  complete: 0.4,
} as const;

// How many interactions before we start trusting implicit data more
const INTERACTION_THRESHOLDS = {
  START_BLENDING: 10,      // Start considering implicit at 10 interactions
  EQUAL_WEIGHT: 50,        // 50/50 blend at 50 interactions
  TRUST_IMPLICIT: 100,     // 70% implicit at 100+ interactions
} as const;

// Note: Divergence is detected when implicit score >= 3 for untagged skills
// or when explicit score >= 4 but implicit score < 1 for unused skills

// ============ BEHAVIOR TRACKING ============

export type InteractionType = "view" | "like" | "submit" | "complete";

/**
 * Record a user interaction with a bounty and update behavior profiles
 */
export async function trackBehavior(
  userId: string,
  bountyId: number,
  interactionType: InteractionType
): Promise<void> {
  // 1. Get bounty details (price, tags)
  const bountyData = await db.query.bounty.findFirst({
    where: eq(bounty.id, bountyId),
  });

  if (!bountyData) return;

  // 2. Get bounty tags
  const bountyTags = await db
    .select({ tagId: bountyTag.tagId })
    .from(bountyTag)
    .where(eq(bountyTag.bountyId, bountyId));

  // 3. Update tag behavior for each tag on this bounty
  for (const bt of bountyTags) {
    await updateTagBehavior(userId, bt.tagId, interactionType);
  }

  // 4. Update price behavior
  await updatePriceBehavior(userId, bountyData.price, interactionType);

  // 5. Update blend config (shift weights based on total interactions)
  await updateBlendConfig(userId);

  // 6. Check for divergence
  await checkDivergence(userId);
}

/**
 * Update behavior score for a specific tag
 */
async function updateTagBehavior(
  userId: string,
  tagId: number,
  interactionType: InteractionType
): Promise<void> {
  // Check if record exists
  const existing = await db.query.userBehaviorTag.findFirst({
    where: and(
      eq(userBehaviorTag.userId, userId),
      eq(userBehaviorTag.tagId, tagId)
    ),
  });

  const countField = `${interactionType}Count` as const;
  const scoreField = `${interactionType}Score` as const;

  if (existing) {
    // Update existing record
    const newCount = (existing[countField] || 0) + 1;
    const newScore = Math.min(10, newCount * BEHAVIOR_WEIGHTS[interactionType] * 2);

    await db
      .update(userBehaviorTag)
      .set({
        [countField]: newCount,
        [scoreField]: newScore,
        implicitScore: computeImplicitTagScore({
          ...existing,
          [countField]: newCount,
          [scoreField]: newScore,
        }),
      })
      .where(
        and(
          eq(userBehaviorTag.userId, userId),
          eq(userBehaviorTag.tagId, tagId)
        )
      );
  } else {
    // Create new record
    const initialCount = 1;
    const initialScore = BEHAVIOR_WEIGHTS[interactionType] * 2;

    await db.insert(userBehaviorTag).values({
      userId,
      tagId,
      [countField]: initialCount,
      [scoreField]: initialScore,
      implicitScore: initialScore,
    });
  }
}

/**
 * Compute implicit tag score from behavior counts
 */
function computeImplicitTagScore(behavior: {
  viewScore: number;
  likeScore: number;
  submitScore: number;
  completeScore: number;
}): number {
  // Weighted combination, capped at 10
  const raw =
    behavior.viewScore * 0.1 +
    behavior.likeScore * 0.2 +
    behavior.submitScore * 0.3 +
    behavior.completeScore * 0.4;

  return Math.min(10, raw);
}

/**
 * Update price behavior tracking
 */
async function updatePriceBehavior(
  userId: string,
  price: number,
  interactionType: InteractionType
): Promise<void> {
  const existing = await db.query.userBehaviorPrice.findFirst({
    where: eq(userBehaviorPrice.userId, userId),
  });

  if (!existing) {
    // Create record if doesn't exist
    await db.insert(userBehaviorPrice).values({
      userId,
      avgPriceViewed: interactionType === "view" ? price : 0,
      avgPriceLiked: interactionType === "like" ? price : 0,
      avgPriceSubmitted: interactionType === "submit" ? price : 0,
      avgPriceCompleted: interactionType === "complete" ? price : 0,
    });
    return;
  }

  // Rolling average update (exponential moving average with alpha=0.1)
  const alpha = 0.1;
  const fieldMap = {
    view: "avgPriceViewed",
    like: "avgPriceLiked",
    submit: "avgPriceSubmitted",
    complete: "avgPriceCompleted",
  } as const;

  const field = fieldMap[interactionType];
  const currentAvg = existing[field] || 0;
  const newAvg = currentAvg === 0 ? price : currentAvg * (1 - alpha) + price * alpha;

  // Compute implicit price range from behavior
  const allAvgs = [
    interactionType === "view" ? newAvg : existing.avgPriceViewed,
    interactionType === "like" ? newAvg : existing.avgPriceLiked,
    interactionType === "submit" ? newAvg : existing.avgPriceSubmitted,
    interactionType === "complete" ? newAvg : existing.avgPriceCompleted,
  ].filter((v) => v > 0);

  const implicitMin = allAvgs.length > 0 ? Math.min(...allAvgs) * 0.5 : null;
  const implicitMax = allAvgs.length > 0 ? Math.max(...allAvgs) * 1.5 : null;

  await db
    .update(userBehaviorPrice)
    .set({
      [field]: newAvg,
      implicitPriceMin: implicitMin,
      implicitPriceMax: implicitMax,
    })
    .where(eq(userBehaviorPrice.userId, userId));
}

/**
 * Update blend config based on total interactions
 */
async function updateBlendConfig(userId: string): Promise<void> {
  const config = await db.query.userBlendConfig.findFirst({
    where: eq(userBlendConfig.userId, userId),
  });

  if (!config) return;

  const newTotal = config.totalInteractions + 1;

  // Compute new weights based on interaction count
  let explicitWeight = 0.8;
  let implicitWeight = 0.2;

  if (newTotal >= INTERACTION_THRESHOLDS.TRUST_IMPLICIT) {
    explicitWeight = 0.3;
    implicitWeight = 0.7;
  } else if (newTotal >= INTERACTION_THRESHOLDS.EQUAL_WEIGHT) {
    explicitWeight = 0.5;
    implicitWeight = 0.5;
  } else if (newTotal >= INTERACTION_THRESHOLDS.START_BLENDING) {
    // Linear interpolation between 80/20 and 50/50
    const progress =
      (newTotal - INTERACTION_THRESHOLDS.START_BLENDING) /
      (INTERACTION_THRESHOLDS.EQUAL_WEIGHT - INTERACTION_THRESHOLDS.START_BLENDING);
    explicitWeight = 0.8 - progress * 0.3;
    implicitWeight = 0.2 + progress * 0.3;
  }

  await db
    .update(userBlendConfig)
    .set({
      totalInteractions: newTotal,
      explicitWeight,
      implicitWeight,
    })
    .where(eq(userBlendConfig.userId, userId));
}

/**
 * Check for divergence between explicit and implicit profiles
 */
async function checkDivergence(userId: string): Promise<void> {
  // Get user's explicit tags
  const explicitTags = await db
    .select({ tagId: userTag.tagId, score: userTag.score })
    .from(userTag)
    .where(eq(userTag.userId, userId));

  // Get user's implicit tag behaviors
  const implicitTags = await db
    .select({
      tagId: userBehaviorTag.tagId,
      implicitScore: userBehaviorTag.implicitScore,
    })
    .from(userBehaviorTag)
    .where(eq(userBehaviorTag.userId, userId));

  // Build maps
  const explicitMap = new Map(explicitTags.map((t) => [t.tagId, t.score]));
  const implicitMap = new Map(implicitTags.map((t) => [t.tagId, t.implicitScore]));

  // Check for divergence:
  // 1. High implicit score for tags not in explicit profile
  // 2. Low implicit engagement for tags with high explicit score

  for (const [tagId, implicitScore] of implicitMap) {
    const explicitScore = explicitMap.get(tagId);

    // User engaging with tags they didn't claim
    if (!explicitScore && implicitScore >= 3) {
      await db
        .update(userBehaviorTag)
        .set({
          divergenceDetected: true,
          lastExplicitScore: 0,
        })
        .where(
          and(
            eq(userBehaviorTag.userId, userId),
            eq(userBehaviorTag.tagId, tagId)
          )
        );
    }

    // User not engaging with tags they claimed to know well
    if (explicitScore && explicitScore >= 4 && implicitScore < 1) {
      await db
        .update(userBehaviorTag)
        .set({
          divergenceDetected: true,
          lastExplicitScore: explicitScore,
        })
        .where(
          and(
            eq(userBehaviorTag.userId, userId),
            eq(userBehaviorTag.tagId, tagId)
          )
        );
    }
  }
}

// ============ BLENDED SCORING ============

export interface BlendedTagScore {
  tagId: number;
  tagName: string;
  explicitScore: number;
  implicitScore: number;
  blendedScore: number;
  divergent: boolean;
}

/**
 * Get blended tag scores for a user
 */
export async function getBlendedTagScores(userId: string): Promise<BlendedTagScore[]> {
  // Get blend config
  const config = await db.query.userBlendConfig.findFirst({
    where: eq(userBlendConfig.userId, userId),
  });

  const explicitWeight = config?.explicitWeight ?? 0.8;
  const implicitWeight = config?.implicitWeight ?? 0.2;

  // Get explicit tags
  const explicitTags = await db
    .select({
      tagId: userTag.tagId,
      tagName: tag.name,
      score: userTag.score,
    })
    .from(userTag)
    .innerJoin(tag, eq(userTag.tagId, tag.id))
    .where(eq(userTag.userId, userId));

  // Get implicit tags
  const implicitTags = await db
    .select({
      tagId: userBehaviorTag.tagId,
      implicitScore: userBehaviorTag.implicitScore,
      divergenceDetected: userBehaviorTag.divergenceDetected,
    })
    .from(userBehaviorTag)
    .where(eq(userBehaviorTag.userId, userId));

  // Build maps
  const explicitMap = new Map(
    explicitTags.map((t) => [t.tagId, { name: t.tagName, score: t.score }])
  );
  const implicitMap = new Map(
    implicitTags.map((t) => [t.tagId, { score: t.implicitScore, divergent: t.divergenceDetected }])
  );

  // Get all tag names for implicit-only tags
  const implicitOnlyTagIds = [...implicitMap.keys()].filter((id) => !explicitMap.has(id));
  let implicitOnlyTagNames: { id: number; name: string }[] = [];
  if (implicitOnlyTagIds.length > 0) {
    implicitOnlyTagNames = await db
      .select({ id: tag.id, name: tag.name })
      .from(tag)
      .where(inArray(tag.id, implicitOnlyTagIds));
  }

  const tagNameMap = new Map(implicitOnlyTagNames.map((t) => [t.id, t.name]));

  // Combine all tag IDs
  const allTagIds = new Set([...explicitMap.keys(), ...implicitMap.keys()]);

  // Compute blended scores
  const results: BlendedTagScore[] = [];

  for (const tagId of allTagIds) {
    const explicit = explicitMap.get(tagId);
    const implicit = implicitMap.get(tagId);

    const explicitScore = explicit?.score ?? 0;
    const implicitScore = implicit?.score ?? 0;

    // Blend scores
    const blendedScore =
      explicitScore * explicitWeight + implicitScore * implicitWeight;

    results.push({
      tagId,
      tagName: explicit?.name ?? tagNameMap.get(tagId) ?? `Tag ${tagId}`,
      explicitScore,
      implicitScore,
      blendedScore,
      divergent: implicit?.divergent ?? false,
    });
  }

  // Sort by blended score descending
  results.sort((a, b) => b.blendedScore - a.blendedScore);

  return results;
}

/**
 * Get blended price preferences
 */
export async function getBlendedPriceRange(
  userId: string
): Promise<{ min: number; max: number; source: "explicit" | "implicit" | "blended" }> {
  const config = await db.query.userBlendConfig.findFirst({
    where: eq(userBlendConfig.userId, userId),
  });

  const priceBehavior = await db.query.userBehaviorPrice.findFirst({
    where: eq(userBehaviorPrice.userId, userId),
  });

  // Get explicit price range from onboarding
  const onboarding = await db.query.userOnboarding.findFirst({
    where: eq(userBehaviorPrice.userId, userId),
  });

  const explicitMin = onboarding?.priceRangeMin ?? 100;
  const explicitMax = onboarding?.priceRangeMax ?? 2000;

  // If no behavior data, use explicit
  if (!priceBehavior?.implicitPriceMin || !priceBehavior?.implicitPriceMax) {
    return { min: explicitMin, max: explicitMax, source: "explicit" };
  }

  const implicitMin = priceBehavior.implicitPriceMin;
  const implicitMax = priceBehavior.implicitPriceMax;

  const explicitWeight = config?.explicitWeight ?? 0.8;
  const implicitWeight = config?.implicitWeight ?? 0.2;

  // Blend
  const blendedMin = explicitMin * explicitWeight + implicitMin * implicitWeight;
  const blendedMax = explicitMax * explicitWeight + implicitMax * implicitWeight;

  return {
    min: Math.round(blendedMin),
    max: Math.round(blendedMax),
    source: "blended",
  };
}

// ============ DIVERGENCE DETECTION ============

export interface DivergenceAlert {
  type: "new_interest" | "unused_skill";
  tagId: number;
  tagName: string;
  explicitScore: number;
  implicitScore: number;
  message: string;
}

/**
 * Get divergence alerts for a user (for "are you sure?" prompts)
 */
export async function getDivergenceAlerts(userId: string): Promise<DivergenceAlert[]> {
  const config = await db.query.userBlendConfig.findFirst({
    where: eq(userBlendConfig.userId, userId),
  });

  // Don't show prompts too frequently
  if (config?.lastDivergencePrompt) {
    const hoursSinceLastPrompt =
      (Date.now() - config.lastDivergencePrompt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastPrompt < 24) {
      return [];
    }
  }

  // Get divergent tags
  const divergentTags = await db
    .select({
      tagId: userBehaviorTag.tagId,
      implicitScore: userBehaviorTag.implicitScore,
      lastExplicitScore: userBehaviorTag.lastExplicitScore,
    })
    .from(userBehaviorTag)
    .where(
      and(
        eq(userBehaviorTag.userId, userId),
        eq(userBehaviorTag.divergenceDetected, true)
      )
    );

  if (divergentTags.length === 0) return [];

  // Get tag names
  const tagIds = divergentTags.map((t) => t.tagId);
  let tagNames: { id: number; name: string }[] = [];
  if (tagIds.length > 0) {
    tagNames = await db
      .select({ id: tag.id, name: tag.name })
      .from(tag)
      .where(inArray(tag.id, tagIds));
  }

  const nameMap = new Map(tagNames.map((t) => [t.id, t.name]));

  const alerts: DivergenceAlert[] = [];

  for (const dt of divergentTags) {
    const tagName = nameMap.get(dt.tagId) ?? `Tag ${dt.tagId}`;
    const explicitScore = dt.lastExplicitScore ?? 0;

    if (explicitScore === 0 && dt.implicitScore >= 3) {
      // New interest detected
      alerts.push({
        type: "new_interest",
        tagId: dt.tagId,
        tagName,
        explicitScore: 0,
        implicitScore: dt.implicitScore,
        message: `You've been engaging with ${tagName} bounties. Add it to your skills?`,
      });
    } else if (explicitScore >= 4 && dt.implicitScore < 1) {
      // Claimed skill not being used
      alerts.push({
        type: "unused_skill",
        tagId: dt.tagId,
        tagName,
        explicitScore,
        implicitScore: dt.implicitScore,
        message: `You said you know ${tagName} (${explicitScore}/5), but haven't engaged with those bounties. Still accurate?`,
      });
    }
  }

  return alerts;
}

/**
 * Mark divergence prompt as shown
 */
export async function markDivergencePromptShown(userId: string): Promise<void> {
  await db
    .update(userBlendConfig)
    .set({
      lastDivergencePrompt: new Date(),
      divergencePromptCount: sql`${userBlendConfig.divergencePromptCount} + 1`,
    })
    .where(eq(userBlendConfig.userId, userId));
}

/**
 * Clear divergence flag for a tag (after user responds to prompt)
 */
export async function clearDivergence(userId: string, tagId: number): Promise<void> {
  await db
    .update(userBehaviorTag)
    .set({ divergenceDetected: false })
    .where(
      and(
        eq(userBehaviorTag.userId, userId),
        eq(userBehaviorTag.tagId, tagId)
      )
    );
}
