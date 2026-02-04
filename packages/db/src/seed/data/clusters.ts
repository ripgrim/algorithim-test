// User skill clusters for realistic social graph connections
// Users in the same cluster are more likely to be mutuals

export const CLUSTERS: Record<string, string[]> = {
  webdev: [
    "typescript",
    "javascript",
    "react",
    "nextjs",
    "frontend",
    "vue",
    "angular",
    "svelte",
  ],
  backend: [
    "python",
    "rust",
    "go",
    "java",
    "backend",
    "api-design",
    "database",
    "node",
    "express",
  ],
  design: [
    "ui-design",
    "ux-research",
    "frontend",
    "accessibility",
    "react",
    "css",
  ],
  devops: [
    "devops",
    "docker",
    "kubernetes",
    "aws",
    "gcp",
    "terraform",
    "ci-cd",
    "monitoring",
  ],
  data: [
    "python",
    "data-science",
    "machine-learning",
    "database",
    "api-design",
  ],
};

export const CLUSTER_NAMES = Object.keys(CLUSTERS) as (keyof typeof CLUSTERS)[];

// Tier configuration for bounties
export const TIER_CONFIG = {
  basic: {
    priceMin: 10,
    priceMax: 200,
    viewsMin: 10,
    viewsMax: 500,
    submissionsMax: 10,
    likesMax: 20,
  },
  middle: {
    priceMin: 200,
    priceMax: 1000,
    viewsMin: 100,
    viewsMax: 2000,
    submissionsMax: 50,
    likesMax: 100,
  },
  high: {
    priceMin: 1000,
    priceMax: 10000,
    viewsMin: 500,
    viewsMax: 10000,
    submissionsMax: 200,
    likesMax: 500,
  },
} as const;

export type BountyTier = keyof typeof TIER_CONFIG;

// Distribution of user levels
export const USER_DISTRIBUTION = {
  beginner: 0.6,
  intermediate: 0.3,
  expert: 0.1,
} as const;

export type UserLevel = keyof typeof USER_DISTRIBUTION;

// Distribution of bounty tiers
export const BOUNTY_DISTRIBUTION = {
  basic: 0.5,
  middle: 0.35,
  high: 0.15,
} as const;

// Utility: weighted random selection
export function weightedRandom<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let random = Math.random() * total;

  for (const [key, weight] of entries) {
    random -= weight;
    if (random <= 0) return key;
  }

  return entries[0]![0];
}
