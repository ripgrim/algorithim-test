import { faker } from "@faker-js/faker";
import type { InferInsertModel } from "drizzle-orm";
import { db } from "../db";
import { user, userProfile, userTag } from "../../schema";
import {
  CLUSTERS,
  CLUSTER_NAMES,
  USER_DISTRIBUTION,
  weightedRandom,
  type UserLevel,
} from "../data/clusters";

type UserInsert = InferInsertModel<typeof user>;
type UserProfileInsert = InferInsertModel<typeof userProfile>;
type UserTagInsert = InferInsertModel<typeof userTag>;

export interface GeneratedUser {
  id: string;
  name: string;
  email: string;
  level: UserLevel;
  cluster: string;
}

// Generate users
export async function generateUsers(count: number): Promise<GeneratedUser[]> {
  console.log(`Generating ${count} users...`);

  const users: GeneratedUser[] = [];
  const userInserts: UserInsert[] = [];

  for (let i = 0; i < count; i++) {
    const id = faker.string.uuid();
    const level = weightedRandom(USER_DISTRIBUTION);
    const cluster = faker.helpers.arrayElement(CLUSTER_NAMES);

    users.push({
      id,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      level,
      cluster,
    });

    userInserts.push({
      id,
      name: users[i]!.name,
      email: users[i]!.email,
      emailVerified: true,
    });
  }

  // Batch insert users
  const BATCH_SIZE = 500;
  for (let i = 0; i < userInserts.length; i += BATCH_SIZE) {
    const batch = userInserts.slice(i, i + BATCH_SIZE);
    await db.insert(user).values(batch);
    console.log(`  Inserted users ${i + 1}-${Math.min(i + BATCH_SIZE, userInserts.length)}`);
  }

  console.log(`  Created ${count} users`);
  return users;
}

// Generate user profiles with tier/score/avgPrice based on level
export async function generateUserProfiles(users: GeneratedUser[]): Promise<void> {
  console.log(`Generating ${users.length} user profiles...`);

  const profiles: UserProfileInsert[] = [];

  for (const u of users) {
    let platformScore: number;
    let avgPriceViewed: number;
    let accessTier: "basic" | "middle" | "high";
    let engagementScore: number;
    let totalInteractions: number;

    switch (u.level) {
      case "beginner":
        platformScore = faker.number.float({ min: 2, max: 4, fractionDigits: 1 });
        avgPriceViewed = faker.number.float({ min: 20, max: 150, fractionDigits: 0 });
        accessTier = "basic";
        engagementScore = faker.number.float({ min: 0, max: 25, fractionDigits: 1 });
        totalInteractions = faker.number.int({ min: 0, max: 20 });
        break;
      case "intermediate":
        platformScore = faker.number.float({ min: 4, max: 7, fractionDigits: 1 });
        avgPriceViewed = faker.number.float({ min: 150, max: 800, fractionDigits: 0 });
        accessTier = "middle";
        engagementScore = faker.number.float({ min: 25, max: 60, fractionDigits: 1 });
        totalInteractions = faker.number.int({ min: 20, max: 100 });
        break;
      case "expert":
        platformScore = faker.number.float({ min: 7, max: 10, fractionDigits: 1 });
        avgPriceViewed = faker.number.float({ min: 800, max: 5000, fractionDigits: 0 });
        accessTier = "high";
        engagementScore = faker.number.float({ min: 60, max: 100, fractionDigits: 1 });
        totalInteractions = faker.number.int({ min: 100, max: 500 });
        break;
    }

    profiles.push({
      userId: u.id,
      totalInteractions,
      engagementScore,
      avgPriceViewed,
      accessTier,
      platformScore,
      githubAccountAge: faker.number.int({ min: 30, max: 3650 }),
      githubPrAcceptanceRate: faker.number.float({ min: 0.1, max: 0.95, fractionDigits: 2 }),
      githubLanguages: JSON.stringify(
        faker.helpers.arrayElements(
          ["typescript", "javascript", "python", "rust", "go", "java"],
          { min: 1, max: 5 }
        )
      ),
    });
  }

  // Batch insert profiles
  const BATCH_SIZE = 500;
  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);
    await db.insert(userProfile).values(batch);
  }

  console.log(`  Created ${profiles.length} user profiles`);
}

// Generate user tags (skills) - cluster-aware
export async function generateUserTags(
  users: GeneratedUser[],
  allTags: { id: number; name: string }[]
): Promise<void> {
  console.log(`Generating user tags...`);

  const tagMap = new Map(allTags.map((t) => [t.name, t.id]));
  const userTags: UserTagInsert[] = [];

  for (const u of users) {
    const clusterTags = CLUSTERS[u.cluster] || [];
    const numTags = faker.number.int({ min: 3, max: 8 });

    // 70% from cluster, 30% random
    const numClusterTags = Math.ceil(numTags * 0.7);
    const numRandomTags = numTags - numClusterTags;

    // Select cluster tags
    const availableClusterTags = clusterTags.filter((t) => tagMap.has(t));
    const selectedClusterTags = faker.helpers.arrayElements(
      availableClusterTags,
      Math.min(numClusterTags, availableClusterTags.length)
    );

    // Select random tags (not in cluster)
    const nonClusterTags = allTags.filter((t) => !clusterTags.includes(t.name));
    const selectedRandomTags = faker.helpers
      .arrayElements(nonClusterTags, Math.min(numRandomTags, nonClusterTags.length))
      .map((t) => t.name);

    const allSelectedTags = [...selectedClusterTags, ...selectedRandomTags];

    for (let i = 0; i < allSelectedTags.length; i++) {
      const tagName = allSelectedTags[i]!;
      const tagId = tagMap.get(tagName);
      if (!tagId) continue;

      // Higher scores for cluster tags (first ones)
      const score =
        i < selectedClusterTags.length
          ? faker.number.int({ min: 3, max: 5 })
          : faker.number.int({ min: 1, max: 3 });

      userTags.push({
        userId: u.id,
        tagId,
        score,
        source: "manual",
      });
    }
  }

  // Batch insert user tags
  const BATCH_SIZE = 1000;
  for (let i = 0; i < userTags.length; i += BATCH_SIZE) {
    const batch = userTags.slice(i, i + BATCH_SIZE);
    await db.insert(userTag).values(batch);
  }

  console.log(`  Created ${userTags.length} user tags`);
}
