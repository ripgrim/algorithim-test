import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";

// Tags table - categories like "typescript", "backend", "ui-design"
export const tag = pgTable(
  "tag",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    category: text("category").notNull(), // "language", "domain", "skill", "framework", "tool"
    popularity: integer("popularity").default(0), // How many bounties use this tag
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("tag_name_idx").on(table.name),
    index("tag_category_idx").on(table.category),
  ]
);

// Note: Tag relations are defined in a separate relations file to avoid circular imports
