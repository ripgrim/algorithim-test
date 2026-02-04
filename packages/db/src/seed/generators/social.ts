import { faker } from "@faker-js/faker";
import type { InferInsertModel } from "drizzle-orm";
import { db } from "../db";
import { mutual } from "../../schema";
import { CLUSTER_NAMES } from "../data/clusters";
import type { GeneratedUser } from "./users";

type MutualInsert = InferInsertModel<typeof mutual>;

// Generate mutual connections (social graph Layer 1)
// Layer 2 and 3 are computed at query time
export async function generateMutuals(users: GeneratedUser[]): Promise<void> {
  console.log(`Generating mutual connections...`);

  const mutuals: MutualInsert[] = [];

  // Group users by cluster for more realistic connections
  const usersByCluster: Record<string, GeneratedUser[]> = {};
  for (const cluster of CLUSTER_NAMES) {
    usersByCluster[cluster] = [];
  }

  for (const u of users) {
    if (usersByCluster[u.cluster]) {
      usersByCluster[u.cluster]!.push(u);
    }
  }

  // Track existing connections to avoid duplicates
  const existingConnections = new Set<string>();

  for (const user of users) {
    // Each user has 5-20 mutuals
    const numMutuals = faker.number.int({ min: 5, max: 20 });

    // 70% from same cluster, 30% cross-cluster
    const numSameCluster = Math.ceil(numMutuals * 0.7);
    const numCrossCluster = numMutuals - numSameCluster;

    // Get users from same cluster (excluding self)
    const sameClusterUsers = (usersByCluster[user.cluster] || []).filter(
      (u) => u.id !== user.id
    );

    // Get users from other clusters
    const crossClusterUsers = users.filter(
      (u) => u.id !== user.id && u.cluster !== user.cluster
    );

    // Select same-cluster mutuals
    const selectedSameCluster = faker.helpers.arrayElements(
      sameClusterUsers,
      Math.min(numSameCluster, sameClusterUsers.length)
    );

    // Select cross-cluster mutuals
    const selectedCrossCluster = faker.helpers.arrayElements(
      crossClusterUsers,
      Math.min(numCrossCluster, crossClusterUsers.length)
    );

    const allSelectedMutuals = [...selectedSameCluster, ...selectedCrossCluster];

    for (const mutualUser of allSelectedMutuals) {
      // Create a unique key for this connection (sorted to ensure consistency)
      const connectionKey = [user.id, mutualUser.id].sort().join("-");

      // Skip if this connection already exists
      if (existingConnections.has(connectionKey)) {
        continue;
      }

      existingConnections.add(connectionKey);

      // Connection strength: higher for same cluster
      const strength =
        user.cluster === mutualUser.cluster
          ? faker.number.float({ min: 0.6, max: 1.0, fractionDigits: 2 })
          : faker.number.float({ min: 0.3, max: 0.7, fractionDigits: 2 });

      // Add bidirectional connections (both directions)
      mutuals.push({
        userId: user.id,
        mutualId: mutualUser.id,
        layer: 1,
        strength,
      });

      mutuals.push({
        userId: mutualUser.id,
        mutualId: user.id,
        layer: 1,
        strength,
      });
    }
  }

  // Batch insert mutuals
  const BATCH_SIZE = 1000;
  for (let i = 0; i < mutuals.length; i += BATCH_SIZE) {
    const batch = mutuals.slice(i, i + BATCH_SIZE);
    await db.insert(mutual).values(batch);
  }

  console.log(`  Created ${mutuals.length} mutual connections (${existingConnections.size} unique pairs)`);
}
