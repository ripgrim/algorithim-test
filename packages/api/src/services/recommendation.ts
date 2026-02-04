/**
 * Recommendation Engine Service
 *
 * Scoring Weights (v3):
 *   - 55% relevance (tag match) - do your skills match?
 *   - 15% social boost (mutuals engaged) - did people you follow engage?
 *   - 20% price affinity (tier-aware) - is the price attractive?
 *   - 10% bounty engagement (popularity) - is it popular?
 *
 * Minimum relevance threshold: 3.0 (bounties below this are filtered out)
 */

// ============ CONSTANTS ============

const WEIGHTS = {
  RELEVANCE: 0.55,      // 55% - primary filter
  SOCIAL: 0.15,         // 15% - social proof
  PRICE: 0.20,          // 20% - the closer, gets users to act
  ENGAGEMENT: 0.10,     // 10% - popularity
} as const;

const MIN_RELEVANCE_THRESHOLD = 3.0; // Bounties must have at least this relevance score

// ============ TYPES ============

export interface UserTagScore {
  tagId: number;
  tagName: string;
  score: number; // 1-5
}

export interface UserProfile {
  avgPriceViewed: number;
  engagementScore: number;
  accessTier: "basic" | "middle" | "high";
}

export interface MutualConnection {
  mutualId: string;
  layer: 1 | 2 | 3;
  strength: number; // 0-1
}

export interface RecommendationInput {
  userId: string;
  userTags: UserTagScore[];
  userProfile: UserProfile;
  mutuals: MutualConnection[];
}

export interface BountyTag {
  tagId: number;
  weight: number;
}

export interface BountyData {
  id: number;
  title: string;
  description: string;
  price: number;
  tier: "basic" | "middle" | "high";
  status: "open" | "claimed" | "completed" | "expired";
  views: number;
  submissions: number;
  likes: number;
  engagementScore: number;
  creatorId: string | null;
  claimedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  completedAt: Date | null;
}

export interface ScoredBounty {
  bounty: BountyData;
  relevanceScore: number;
  socialBoost: number;
  priceAffinity: number;
  finalScore: number;
}

export interface RecommendationOutput {
  primary: ScoredBounty;
  secondary: ScoredBounty;
  debug: {
    totalCandidates: number;
    filteredByTier: number;
    filteredByRelevance: number;
    topRelevanceScores: number[];
  };
}

// ============ MAIN ALGORITHM ============

export function getRecommendations(
  input: RecommendationInput,
  allBounties: BountyData[],
  bountyTagMap: Map<number, BountyTag[]>,
  mutualInteractions: Map<string, number[]> // mutualId -> bountyIds they interacted with
): RecommendationOutput {
  // Step 1: Filter by access tier
  const accessibleBounties = filterByAccessTier(allBounties, input.userProfile.accessTier);

  // Step 2: Score all accessible bounties
  const allScoredBounties: ScoredBounty[] = accessibleBounties.map((bounty) => {
    const tags = bountyTagMap.get(bounty.id) || [];

    // 2a: Compute relevance score (0-10)
    const relevanceScore = computeRelevanceScore(input.userTags, tags);

    // 2b: Compute social boost (0-2)
    const socialBoost = computeSocialBoost(bounty.id, input.mutuals, mutualInteractions);

    // 2c: Compute price affinity (0-1) - now tier-aware
    const priceAffinity = computePriceAffinityTierAware(
      bounty.price,
      bounty.tier,
      input.userProfile.avgPriceViewed,
      input.userProfile.accessTier
    );

    // 2d: Final score (weighted combination)
    // New weights: 65% relevance, 20% social, 5% price, 10% engagement
    const normalizedEngagement = Math.min((bounty.engagementScore || 0) / 10, 1); // 0-1

    // All scores normalized to 0-1 range, then weighted
    const finalScore =
      (relevanceScore / 10) * WEIGHTS.RELEVANCE * 10 +  // 0-6.5 points
      (socialBoost / 2) * WEIGHTS.SOCIAL * 10 +          // 0-2 points
      priceAffinity * WEIGHTS.PRICE * 10 +               // 0-0.5 points
      normalizedEngagement * WEIGHTS.ENGAGEMENT * 10;    // 0-1 points
    // Max total: ~10 points

    return {
      bounty,
      relevanceScore,
      socialBoost,
      priceAffinity,
      finalScore,
    };
  });

  // Step 3: Filter by minimum relevance threshold
  const scoredBounties = allScoredBounties.filter(
    (sb) => sb.relevanceScore >= MIN_RELEVANCE_THRESHOLD
  );

  // Step 4: Sort by final score (descending)
  scoredBounties.sort((a, b) => b.finalScore - a.finalScore);

  // Step 5: Select primary (highest score)
  const primary = scoredBounties[0];

  // Step 6: Select secondary (lower relevance, but decent overall score)
  const secondary = selectStretchBounty(scoredBounties);

  // Handle edge cases - if no bounties pass threshold, fall back to best available
  if (!primary) {
    allScoredBounties.sort((a, b) => b.finalScore - a.finalScore);
    const fallback = allScoredBounties[0];
    if (!fallback) {
      throw new Error("No bounties available for recommendations");
    }
    return {
      primary: fallback,
      secondary: allScoredBounties[1] || fallback,
      debug: {
        totalCandidates: allBounties.length,
        filteredByTier: accessibleBounties.length,
        filteredByRelevance: 0,
        topRelevanceScores: allScoredBounties.slice(0, 5).map((s) => s.relevanceScore),
      },
    };
  }

  return {
    primary,
    secondary: secondary || scoredBounties[1] || primary,
    debug: {
      totalCandidates: allBounties.length,
      filteredByTier: accessibleBounties.length,
      filteredByRelevance: scoredBounties.length,
      topRelevanceScores: scoredBounties.slice(0, 5).map((s) => s.relevanceScore),
    },
  };
}

// ============ HELPER FUNCTIONS ============

/**
 * Filter bounties by user's access tier
 * Users can see bounties at or below their tier level
 */
function filterByAccessTier(
  bounties: BountyData[],
  accessTier: "basic" | "middle" | "high"
): BountyData[] {
  const tierOrder: Record<"basic" | "middle" | "high", number> = { basic: 1, middle: 2, high: 3 };
  const userTierLevel = tierOrder[accessTier];

  return bounties.filter((b) => {
    const bountyTierLevel = tierOrder[b.tier];
    return bountyTierLevel <= userTierLevel;
  });
}

/**
 * Compute relevance score based on tag matching
 * Returns 0-10 score
 */
function computeRelevanceScore(
  userTags: UserTagScore[],
  bountyTags: BountyTag[]
): number {
  if (bountyTags.length === 0) return 0;

  // Create map of user tag scores
  const userTagMap = new Map(userTags.map((t) => [t.tagId, t.score]));

  let totalScore = 0;
  let totalWeight = 0;

  for (const bt of bountyTags) {
    const userScore = userTagMap.get(bt.tagId) || 0;
    totalScore += userScore * bt.weight;
    totalWeight += bt.weight;
  }

  // Normalize to 0-10 scale
  // Max possible: 5 (max user score) * 1.0 (max weight) = 5 per tag
  // Normalize so full match = 10
  return totalWeight > 0 ? (totalScore / totalWeight) * 2 : 0;
}

/**
 * Compute social boost based on mutual interactions
 * Returns 0-2 score
 */
function computeSocialBoost(
  bountyId: number,
  mutuals: MutualConnection[],
  mutualInteractions: Map<string, number[]>
): number {
  let boost = 0;

  for (const mutual of mutuals) {
    const interactedBounties = mutualInteractions.get(mutual.mutualId) || [];

    if (interactedBounties.includes(bountyId)) {
      // Layer decay: Layer 1 = 1.0, Layer 2 = 0.5, Layer 3 = 0.25
      const layerMultiplier = 1 / Math.pow(2, mutual.layer - 1);
      boost += mutual.strength * layerMultiplier;
    }
  }

  // Cap at 2.0
  return Math.min(boost, 2.0);
}

/**
 * Compute price affinity score (tier-aware)
 * 
 * The goal: recommend bounties that match what the user is actually interested in.
 * If a user has been viewing $5000 bounties, a $64 bounty is probably not interesting.
 * 
 * Returns 0-1 score
 */
function computePriceAffinityTierAware(
  bountyPrice: number,
  bountyTier: "basic" | "middle" | "high",
  avgPriceViewed: number,
  userAccessTier: "basic" | "middle" | "high"
): number {
  // If no viewing history, use tier matching as fallback
  if (avgPriceViewed <= 0) {
    // New users: prefer bounties in their tier
    return bountyTier === userAccessTier ? 0.8 : 0.5;
  }

  // Primary: How close is bounty price to what user typically views?
  const historyScore = computePriceHistoryScore(bountyPrice, avgPriceViewed);
  
  // Secondary: Is the bounty in a tier the user can access and might be interested in?
  const tierOrder: Record<"basic" | "middle" | "high", number> = { basic: 1, middle: 2, high: 3 };
  const userTierLevel = tierOrder[userAccessTier];
  const bountyTierLevel = tierOrder[bountyTier];
  
  // Prefer bounties at or near user's tier level
  const tierDiff = userTierLevel - bountyTierLevel;
  let tierBonus = 0;
  if (tierDiff === 0) tierBonus = 0.1;      // Same tier: small bonus
  else if (tierDiff === 1) tierBonus = 0;    // One tier below: neutral
  else if (tierDiff >= 2) tierBonus = -0.1;  // Two tiers below: small penalty
  
  return Math.max(0, Math.min(1, historyScore + tierBonus));
}

/**
 * Helper: compute score based on viewing history
 * 
 * If user views $5000 bounties, a $64 bounty (ratio 0.01) should score poorly.
 * If user views $100 bounties, a $64 bounty (ratio 0.64) should score well.
 */
function computePriceHistoryScore(bountyPrice: number, avgPriceViewed: number): number {
  if (avgPriceViewed <= 0) {
    return 0.5; // Neutral for new users
  }

  const ratio = bountyPrice / avgPriceViewed;

  // Optimal ratio is 0.5-2.0 (bounty is 50%-200% of avg viewed)
  if (ratio >= 0.5 && ratio <= 2.0) {
    // Perfect fit in the sweet spot
    return 1.0;
  }

  // Below 0.5: bounty is much cheaper than what user typically views
  if (ratio < 0.5) {
    // ratio 0.5 -> 1.0, ratio 0.25 -> 0.5, ratio 0.1 -> 0.2, ratio 0.01 -> 0.02
    return Math.max(0.1, ratio * 2);
  }

  // Above 2.0: bounty is much more expensive than what user typically views
  // ratio 2.0 -> 1.0, ratio 3.0 -> 0.67, ratio 5.0 -> 0.4
  return Math.max(0.2, 2.0 / ratio);
}

/**
 * Select a "stretch" bounty - one with lower tag relevance but decent overall score
 * This encourages users to explore new areas
 */
function selectStretchBounty(
  scoredBounties: ScoredBounty[]
): ScoredBounty | undefined {
  // Find bounties where:
  // 1. Relevance score is low (user doesn't have matching tags)
  // 2. But final score is still decent (good engagement, social boost, or price match)

  const stretchCandidates = scoredBounties.filter((sb) => {
    // Low relevance (< 30% of max)
    const isLowRelevance = sb.relevanceScore < 3.0;
    // But decent overall score (> 20% of top score)
    const topScore = scoredBounties[0]?.finalScore || 1;
    const isDecentOverall = sb.finalScore > topScore * 0.2;

    return isLowRelevance && isDecentOverall;
  });

  // Sort by final score within stretch candidates
  stretchCandidates.sort((a, b) => b.finalScore - a.finalScore);

  // Return best stretch candidate
  return stretchCandidates[0];
}

// ============ EXPORTED SCORING FUNCTIONS ============

/**
 * Score ALL bounties for a user (for feed view)
 * Returns all bounties with their individual scores
 * 
 * @param applyRelevanceFilter - if true, filters out bounties below MIN_RELEVANCE_THRESHOLD
 */
export function scoreAllBounties(
  input: RecommendationInput,
  allBounties: BountyData[],
  bountyTagMap: Map<number, BountyTag[]>,
  mutualInteractions: Map<string, number[]>,
  applyRelevanceFilter: boolean = true
): ScoredBounty[] {
  // Filter by access tier
  const accessibleBounties = filterByAccessTier(allBounties, input.userProfile.accessTier);

  // Score all accessible bounties
  const scoredBounties: ScoredBounty[] = accessibleBounties.map((bounty) => {
    const tags = bountyTagMap.get(bounty.id) || [];

    const relevanceScore = computeRelevanceScore(input.userTags, tags);
    const socialBoost = computeSocialBoost(bounty.id, input.mutuals, mutualInteractions);
    const priceAffinity = computePriceAffinityTierAware(
      bounty.price,
      bounty.tier,
      input.userProfile.avgPriceViewed,
      input.userProfile.accessTier
    );
    const normalizedEngagement = Math.min((bounty.engagementScore || 0) / 10, 1);

    // New weights: 65% relevance, 20% social, 5% price, 10% engagement
    const finalScore =
      (relevanceScore / 10) * WEIGHTS.RELEVANCE * 10 +
      (socialBoost / 2) * WEIGHTS.SOCIAL * 10 +
      priceAffinity * WEIGHTS.PRICE * 10 +
      normalizedEngagement * WEIGHTS.ENGAGEMENT * 10;

    return {
      bounty,
      relevanceScore,
      socialBoost,
      priceAffinity,
      finalScore,
    };
  });

  // Apply relevance filter if requested
  if (applyRelevanceFilter) {
    return scoredBounties.filter((sb) => sb.relevanceScore >= MIN_RELEVANCE_THRESHOLD);
  }

  return scoredBounties;
}

export interface TagMatchDetail {
  tagId: number;
  tagName: string;
  userScore: number; // User's score for this tag (0 if not in profile)
  bountyWeight: number; // How much this tag weighs in the bounty
  contribution: number; // userScore * bountyWeight
}

/**
 * Get detailed tag matching breakdown for a bounty
 */
export function getTagMatchDetails(
  userTags: UserTagScore[],
  bountyTags: { tagId: number; tagName: string; weight: number }[]
): TagMatchDetail[] {
  const userTagMap = new Map(userTags.map((t) => [t.tagId, { score: t.score, name: t.tagName }]));

  return bountyTags.map((bt) => {
    const userTag = userTagMap.get(bt.tagId);
    const userScore = userTag?.score || 0;
    return {
      tagId: bt.tagId,
      tagName: bt.tagName,
      userScore,
      bountyWeight: bt.weight,
      contribution: userScore * bt.weight,
    };
  });
}
