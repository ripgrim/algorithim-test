import { faker } from "@faker-js/faker";
import type { InferInsertModel } from "drizzle-orm";
import { db } from "../db";
import { bounty, bountyTag } from "../../schema";
import {
  TIER_CONFIG,
  BOUNTY_DISTRIBUTION,
  weightedRandom,
  type BountyTier,
} from "../data/clusters";
import type { GeneratedUser } from "./users";

type BountyInsert = InferInsertModel<typeof bounty>;
type BountyTagInsert = InferInsertModel<typeof bountyTag>;

// Bounty title templates per tier
const BOUNTY_TITLES: Record<BountyTier, string[]> = {
  basic: [
    "Fix CSS alignment issue on mobile",
    "Add dark mode toggle",
    "Write unit tests for auth module",
    "Update README documentation",
    "Implement form validation",
    "Add loading spinners to buttons",
    "Fix TypeScript type errors",
    "Create simple REST endpoint",
    "Add input sanitization",
    "Fix responsive layout bugs",
    "Implement password strength meter",
    "Add email validation",
    "Create basic error handling",
    "Update dependencies to latest",
    "Add basic logging",
  ],
  middle: [
    "Build user dashboard with analytics",
    "Implement OAuth2 authentication flow",
    "Create GraphQL API for existing REST",
    "Build real-time notification system",
    "Implement file upload with S3",
    "Create CI/CD pipeline with GitHub Actions",
    "Build admin panel with RBAC",
    "Implement search with Elasticsearch",
    "Add WebSocket support for live updates",
    "Build API rate limiting system",
    "Implement caching layer with Redis",
    "Create data export functionality",
    "Build audit logging system",
    "Implement two-factor authentication",
    "Create API documentation portal",
  ],
  high: [
    "Architect microservices infrastructure",
    "Build ML-powered recommendation engine",
    "Implement end-to-end encryption",
    "Create distributed caching layer",
    "Build real-time collaboration editor",
    "Implement payment processing system",
    "Create multi-tenant SaaS architecture",
    "Build video streaming platform",
    "Implement event sourcing system",
    "Create Kubernetes deployment pipeline",
    "Build data pipeline with Apache Kafka",
    "Implement GraphQL federation",
    "Create serverless architecture migration",
    "Build real-time analytics dashboard",
    "Implement zero-downtime deployment system",
  ],
};

// Calculate engagement score from metrics
function calculateEngagementScore(views: number, submissions: number, likes: number): number {
  const viewScore = Math.min(views / 100, 30);
  const submissionScore = Math.min(submissions * 2, 40);
  const likeScore = Math.min(likes * 0.5, 30);
  return Math.min(viewScore + submissionScore + likeScore, 100);
}

// Generate bounties
export async function generateBounties(
  count: number,
  users: GeneratedUser[],
  allTags: { id: number; name: string }[]
): Promise<number> {
  console.log(`Generating ${count} bounties...`);

  const bounties: BountyInsert[] = [];
  const bountyTagsData: BountyTagInsert[] = [];

  for (let i = 0; i < count; i++) {
    const tier = weightedRandom(BOUNTY_DISTRIBUTION) as BountyTier;
    const config = TIER_CONFIG[tier];

    const price = faker.number.int({ min: config.priceMin, max: config.priceMax });
    const views = faker.number.int({ min: config.viewsMin, max: config.viewsMax });
    const submissions = faker.number.int({ min: 0, max: config.submissionsMax });
    const likes = faker.number.int({ min: 0, max: config.likesMax });
    const engagementScore = calculateEngagementScore(views, submissions, likes);

    const bountyId = i + 1; // Serial IDs start at 1
    const titleTemplate = faker.helpers.arrayElement(BOUNTY_TITLES[tier]);

    // Randomly assign status
    const status = faker.helpers.weightedArrayElement([
      { value: "open" as const, weight: 0.6 },
      { value: "claimed" as const, weight: 0.2 },
      { value: "completed" as const, weight: 0.15 },
      { value: "expired" as const, weight: 0.05 },
    ]);

    // Pick a random creator
    const creator = faker.helpers.arrayElement(users);

    bounties.push({
      title: `${titleTemplate} #${bountyId}`,
      description: faker.lorem.paragraphs({ min: 2, max: 4 }),
      price,
      tier,
      status,
      views,
      submissions,
      likes,
      engagementScore,
      creatorId: creator.id,
      claimedById: status === "claimed" || status === "completed"
        ? faker.helpers.arrayElement(users.filter((u) => u.id !== creator.id)).id
        : null,
      expiresAt: faker.date.future({ years: 1 }),
      completedAt: status === "completed" ? faker.date.recent({ days: 30 }) : null,
    });

    // Assign 3-7 tags to each bounty
    const numTags = faker.number.int({ min: 3, max: 7 });
    const selectedTags = faker.helpers.arrayElements(allTags, numTags);

    for (let j = 0; j < selectedTags.length; j++) {
      bountyTagsData.push({
        bountyId,
        tagId: selectedTags[j]!.id,
        // First tag has highest weight, others decrease
        weight: j === 0 ? 1.0 : faker.number.float({ min: 0.3, max: 0.9, fractionDigits: 2 }),
      });
    }
  }

  // Batch insert bounties
  const BATCH_SIZE = 500;
  for (let i = 0; i < bounties.length; i += BATCH_SIZE) {
    const batch = bounties.slice(i, i + BATCH_SIZE);
    await db.insert(bounty).values(batch);
    console.log(`  Inserted bounties ${i + 1}-${Math.min(i + BATCH_SIZE, bounties.length)}`);
  }

  // Batch insert bounty tags
  for (let i = 0; i < bountyTagsData.length; i += BATCH_SIZE) {
    const batch = bountyTagsData.slice(i, i + BATCH_SIZE);
    await db.insert(bountyTag).values(batch);
  }

  console.log(`  Created ${bounties.length} bounties with ${bountyTagsData.length} tags`);
  return bounties.length;
}
