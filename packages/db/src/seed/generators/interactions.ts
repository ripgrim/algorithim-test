import { faker } from "@faker-js/faker";
import type { InferInsertModel } from "drizzle-orm";
import { db } from "../db";
import { bountyView, bountyInteraction } from "../../schema";
import type { GeneratedUser } from "./users";

type BountyViewInsert = InferInsertModel<typeof bountyView>;
type BountyInteractionInsert = InferInsertModel<typeof bountyInteraction>;

// Generate bounty views (used for avg price calculation)
export async function generateBountyViews(
  users: GeneratedUser[],
  bountyCount: number
): Promise<void> {
  console.log(`Generating bounty views...`);

  const views: BountyViewInsert[] = [];
  const bountyIds = Array.from({ length: bountyCount }, (_, i) => i + 1);

  for (const u of users) {
    // Each user has viewed 5-50 bounties based on their level
    const numViews =
      u.level === "expert"
        ? faker.number.int({ min: 30, max: 50 })
        : u.level === "intermediate"
          ? faker.number.int({ min: 15, max: 35 })
          : faker.number.int({ min: 5, max: 20 });

    const viewedBountyIds = faker.helpers.arrayElements(bountyIds, numViews);

    for (const bountyId of viewedBountyIds) {
      views.push({
        userId: u.id,
        bountyId,
        viewedAt: faker.date.recent({ days: 90 }),
        duration: faker.number.int({ min: 5, max: 300 }), // 5 seconds to 5 minutes
      });
    }
  }

  // Batch insert views
  const BATCH_SIZE = 1000;
  for (let i = 0; i < views.length; i += BATCH_SIZE) {
    const batch = views.slice(i, i + BATCH_SIZE);
    await db.insert(bountyView).values(batch);
  }

  console.log(`  Created ${views.length} bounty views`);
}

// Generate user interactions (likes, submissions, claims, completions)
export async function generateInteractions(
  users: GeneratedUser[],
  bountyCount: number
): Promise<void> {
  console.log(`Generating user interactions...`);

  const interactions: BountyInteractionInsert[] = [];
  const bountyIds = Array.from({ length: bountyCount }, (_, i) => i + 1);

  const interactionWeights = [
    { value: "view" as const, weight: 0.5 },
    { value: "like" as const, weight: 0.3 },
    { value: "submit" as const, weight: 0.1 },
    { value: "claim" as const, weight: 0.07 },
    { value: "complete" as const, weight: 0.03 },
  ];

  for (const u of users) {
    // Number of interactions based on user level
    const numInteractions =
      u.level === "expert"
        ? faker.number.int({ min: 50, max: 150 })
        : u.level === "intermediate"
          ? faker.number.int({ min: 20, max: 60 })
          : faker.number.int({ min: 5, max: 25 });

    for (let i = 0; i < numInteractions; i++) {
      const bountyId = faker.helpers.arrayElement(bountyIds);
      const type = faker.helpers.weightedArrayElement(interactionWeights);

      interactions.push({
        userId: u.id,
        bountyId,
        type,
        createdAt: faker.date.recent({ days: 90 }),
      });
    }
  }

  // Batch insert interactions
  const BATCH_SIZE = 1000;
  for (let i = 0; i < interactions.length; i += BATCH_SIZE) {
    const batch = interactions.slice(i, i + BATCH_SIZE);
    await db.insert(bountyInteraction).values(batch);
  }

  console.log(`  Created ${interactions.length} interactions`);
}
