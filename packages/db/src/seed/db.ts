// Seed-specific database connection
// Loads .env before connecting to avoid t3-env validation issues

import dotenv from "dotenv";

// Load env FIRST
dotenv.config({ path: "../../apps/web/.env" });

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import ws from "ws";
import * as schema from "../schema";

neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
