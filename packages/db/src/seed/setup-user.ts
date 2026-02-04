// Setup script to create a profile for an existing user
// Usage: bun run src/seed/setup-user.ts <email>

import { db } from "./db";
import { user, userProfile, userTag, tag } from "../schema";
import { eq } from "drizzle-orm";

const emailArg = process.argv[2];

if (!emailArg) {
  console.log("Usage: bun run src/seed/setup-user.ts <email>");
  console.log("Example: bun run src/seed/setup-user.ts grim@example.com");
  process.exit(1);
}

const email: string = emailArg;

async function setupUser() {
  console.log(`Setting up user: ${email}`);

  // 1. Find the user
  const foundUser = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (!foundUser) {
    console.error(`User not found: ${email}`);
    console.log("\nExisting users:");
    const users = await db.select({ email: user.email }).from(user).limit(10);
    users.forEach((u) => console.log(`  - ${u.email}`));
    process.exit(1);
  }

  console.log(`Found user: ${foundUser.name} (${foundUser.id})`);

  // 2. Check if profile exists
  const existingProfile = await db.query.userProfile.findFirst({
    where: eq(userProfile.userId, foundUser.id),
  });

  if (existingProfile) {
    console.log("Profile already exists:");
    console.log(`  - Access Tier: ${existingProfile.accessTier}`);
    console.log(`  - Platform Score: ${existingProfile.platformScore}`);
    console.log(`  - Avg Price Viewed: $${existingProfile.avgPriceViewed}`);
  } else {
    // Create profile - set as "high" tier expert for testing all features
    await db.insert(userProfile).values({
      userId: foundUser.id,
      accessTier: "high", // Full access for testing
      platformScore: 8.5,
      avgPriceViewed: 1500,
      engagementScore: 50,
      totalInteractions: 25,
      githubAccountAge: 1000,
      githubPrAcceptanceRate: 0.85,
      githubLanguages: JSON.stringify(["typescript", "python", "rust"]),
    });
    console.log("Created profile with HIGH tier access");
  }

  // 3. Check existing tags
  const existingTags = await db
    .select({ tagName: tag.name, score: userTag.score })
    .from(userTag)
    .innerJoin(tag, eq(userTag.tagId, tag.id))
    .where(eq(userTag.userId, foundUser.id));

  if (existingTags.length > 0) {
    console.log("\nExisting tags:");
    existingTags.forEach((t) => console.log(`  - ${t.tagName}: ${t.score}/5`));
  } else {
    // Assign default tags (backend-focused like "grim" persona)
    const tagsToAssign = [
      { name: "typescript", score: 5 },
      { name: "backend", score: 5 },
      { name: "api-design", score: 4 },
      { name: "database", score: 4 },
      { name: "fullstack", score: 4 },
      { name: "node", score: 3 },
      { name: "react", score: 3 },
    ];

    const allTags = await db.select().from(tag);
    const tagMap = new Map(allTags.map((t) => [t.name, t.id]));

    const userTagInserts = tagsToAssign
      .filter((t) => tagMap.has(t.name))
      .map((t) => ({
        userId: foundUser.id,
        tagId: tagMap.get(t.name)!,
        score: t.score,
        source: "manual" as const,
      }));

    await db.insert(userTag).values(userTagInserts);
    console.log("\nAssigned tags:");
    tagsToAssign.forEach((t) => console.log(`  - ${t.name}: ${t.score}/5`));
  }

  console.log("\n✓ User setup complete!");
  console.log("\nYou can now use the recommendation API endpoints.");
}

setupUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
