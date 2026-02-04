import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import { db } from "./db"; // Use seed-specific db with dotenv loaded
import { tag } from "../schema";
import { TAG_DEFINITIONS } from "./data/tags";
import { generateUsers, generateUserProfiles, generateUserTags } from "./generators/users";
import { generateBounties } from "./generators/bounties";
import { generateMutuals } from "./generators/social";
import { generateBountyViews, generateInteractions } from "./generators/interactions";

// Parse command line args
const args = process.argv.slice(2);
const isSmall = args.includes("--small");

// Configuration
const CONFIG = {
  small: {
    users: 500,
    bounties: 1000,
  },
  full: {
    users: 5000,
    bounties: 10000,
  },
};

const config = isSmall ? CONFIG.small : CONFIG.full;

// Seed tags
async function seedTags(): Promise<{ id: number; name: string }[]> {
  console.log("Seeding tags...");

  const tagData: { name: string; category: string }[] = [];

  for (const [category, names] of Object.entries(TAG_DEFINITIONS)) {
    for (const name of names) {
      tagData.push({ name, category });
    }
  }

  // Insert tags (ignore conflicts for re-runs)
  await db.insert(tag).values(tagData).onConflictDoNothing();

  // Fetch all tags to get IDs
  const allTags = await db.select({ id: tag.id, name: tag.name }).from(tag);

  console.log(`  Seeded ${allTags.length} tags`);
  return allTags;
}

// Clear all data (for fresh seed)
async function clearData(): Promise<void> {
  console.log("Clearing existing data...");

  // Delete in order respecting foreign keys
  await db.execute(sql`TRUNCATE TABLE recommendation_log CASCADE`);
  await db.execute(sql`TRUNCATE TABLE bounty_interaction CASCADE`);
  await db.execute(sql`TRUNCATE TABLE bounty_view CASCADE`);
  await db.execute(sql`TRUNCATE TABLE bounty_tag CASCADE`);
  await db.execute(sql`TRUNCATE TABLE bounty CASCADE`);
  await db.execute(sql`TRUNCATE TABLE mutual CASCADE`);
  await db.execute(sql`TRUNCATE TABLE user_tag CASCADE`);
  await db.execute(sql`TRUNCATE TABLE user_profile CASCADE`);
  await db.execute(sql`TRUNCATE TABLE tag CASCADE`);
  // Note: We don't truncate the user table to preserve Better Auth users
  // But for seed purposes, we'll create new users

  console.log("  Data cleared");
}

// Main seed function
async function seed(): Promise<void> {
  console.log("=".repeat(60));
  console.log(`Starting seed (${isSmall ? "SMALL" : "FULL"} mode)`);
  console.log(`  Users: ${config.users}`);
  console.log(`  Bounties: ${config.bounties}`);
  console.log("=".repeat(60));

  const startTime = Date.now();

  // Set faker seed for reproducibility
  faker.seed(42);

  try {
    // Clear existing data
    await clearData();

    // 1. Seed tags (50 tags)
    const allTags = await seedTags();

    // 2. Generate users
    const users = await generateUsers(config.users);

    // 3. Generate user profiles
    await generateUserProfiles(users);

    // 4. Generate user tags (skills)
    await generateUserTags(users, allTags);

    // 5. Generate mutual connections (social graph)
    await generateMutuals(users);

    // 6. Generate bounties
    const bountyCount = await generateBounties(config.bounties, users, allTags);

    // 7. Generate bounty views
    await generateBountyViews(users, bountyCount);

    // 8. Generate interactions
    await generateInteractions(users, bountyCount);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("=".repeat(60));
    console.log(`Seed completed in ${duration}s`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

// Run seed
seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  });
