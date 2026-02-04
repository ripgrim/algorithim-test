// Reset a user's profile to trigger fresh onboarding
// Usage: bun run src/seed/reset-user.ts <email>

import { db } from "./db";
import { user } from "../schema/auth";
import { userProfile, userTag, mutual } from "../schema/user-profile";
import { bountyView, bountyInteraction } from "../schema/bounty";
import {
  userOnboarding,
  userBehaviorTag,
  userBehaviorPrice,
  userBlendConfig,
} from "../schema/onboarding";
import { eq } from "drizzle-orm";

const emailArg = process.argv[2];

if (!emailArg) {
  console.log("Usage: bun run src/seed/reset-user.ts <email>");
  console.log("Example: bun run src/seed/reset-user.ts grimstudioss@gmail.com");
  process.exit(1);
}

const email: string = emailArg;

async function resetUser() {
  console.log(`Resetting user: ${email}`);

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

  // 2. Delete all user data (except the user account itself)
  console.log("\nDeleting user data...");

  // Onboarding
  const deletedOnboarding = await db
    .delete(userOnboarding)
    .where(eq(userOnboarding.userId, foundUser.id))
    .returning();
  console.log(`  - Deleted ${deletedOnboarding.length} onboarding record(s)`);

  // Behavior tracking
  const deletedBehaviorTags = await db
    .delete(userBehaviorTag)
    .where(eq(userBehaviorTag.userId, foundUser.id))
    .returning();
  console.log(`  - Deleted ${deletedBehaviorTags.length} behavior tag record(s)`);

  const deletedBehaviorPrice = await db
    .delete(userBehaviorPrice)
    .where(eq(userBehaviorPrice.userId, foundUser.id))
    .returning();
  console.log(`  - Deleted ${deletedBehaviorPrice.length} behavior price record(s)`);

  const deletedBlendConfig = await db
    .delete(userBlendConfig)
    .where(eq(userBlendConfig.userId, foundUser.id))
    .returning();
  console.log(`  - Deleted ${deletedBlendConfig.length} blend config record(s)`);

  // User tags (skills)
  const deletedTags = await db
    .delete(userTag)
    .where(eq(userTag.userId, foundUser.id))
    .returning();
  console.log(`  - Deleted ${deletedTags.length} user tag(s)`);

  // User profile
  const deletedProfile = await db
    .delete(userProfile)
    .where(eq(userProfile.userId, foundUser.id))
    .returning();
  console.log(`  - Deleted ${deletedProfile.length} profile record(s)`);

  // Bounty views
  const deletedViews = await db
    .delete(bountyView)
    .where(eq(bountyView.userId, foundUser.id))
    .returning();
  console.log(`  - Deleted ${deletedViews.length} bounty view(s)`);

  // Bounty interactions
  const deletedInteractions = await db
    .delete(bountyInteraction)
    .where(eq(bountyInteraction.userId, foundUser.id))
    .returning();
  console.log(`  - Deleted ${deletedInteractions.length} bounty interaction(s)`);

  // Mutuals
  const deletedMutuals = await db
    .delete(mutual)
    .where(eq(mutual.userId, foundUser.id))
    .returning();
  console.log(`  - Deleted ${deletedMutuals.length} mutual connection(s)`);

  // 3. Create fresh profile with default values
  console.log("\nCreating fresh profile...");
  await db.insert(userProfile).values({
    userId: foundUser.id,
    accessTier: "high", // Keep high tier for testing
    platformScore: 5.0, // Default starting score
    avgPriceViewed: 0,
    engagementScore: 0,
    totalInteractions: 0,
  });
  console.log("  - Created profile with HIGH tier (for testing all bounties)");

  console.log("\n✓ User reset complete!");
  console.log("\nNext time you visit the app, you'll see the onboarding modal.");
  console.log("All your skills, preferences, and behavior data have been cleared.");
}

resetUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
