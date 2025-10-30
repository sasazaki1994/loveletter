import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      process.env.NEON_DATABASE_URL ??
      "",
  },
  tablesFilter: ["rooms", "players", "games", "hands", "actions", "logs"],
});

