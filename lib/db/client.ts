import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as PgPool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "@/drizzle/schema";

type DrizzleDb = ReturnType<typeof drizzleNeon<typeof schema>> | ReturnType<typeof drizzlePg<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __drizzleDb__: DrizzleDb | undefined;
}

function getDatabaseUrl(): string {
  const databaseUrl =
    process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? "";
  
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL または NEON_DATABASE_URL が未設定です。環境変数を設定してください。",
    );
  }
  
  return databaseUrl;
}

function createDb(): DrizzleDb {
  if (globalThis.__drizzleDb__) {
    return globalThis.__drizzleDb__;
  }
  
  const databaseUrl = getDatabaseUrl();
  const isNeon = Boolean(process.env.NEON_DATABASE_URL) || /\.neon\./i.test(databaseUrl);

  let dbInstance: DrizzleDb;
  if (isNeon) {
    // Neon (serverless/WebSocket)
    neonConfig.webSocketConstructor = (globalThis as any).WebSocket ?? (ws as unknown as typeof WebSocket);
    neonConfig.useSecureWebSocket = true;
    neonConfig.pipelineConnect = "password";
    const pool = new NeonPool({ connectionString: databaseUrl });
    dbInstance = drizzleNeon(pool, { schema, logger: process.env.NODE_ENV === "development" });
  } else {
    // ローカル/通常のPostgreSQL (pg)
    const pool = new PgPool({ connectionString: databaseUrl, ssl: false });
    dbInstance = drizzlePg(pool, { schema, logger: process.env.NODE_ENV === "development" });
  }
  
  if (process.env.NODE_ENV !== "production") {
    globalThis.__drizzleDb__ = dbInstance;
  }
  
  return dbInstance;
}

// 実行時にのみデータベース接続を初期化するためのプロキシ
let dbInstance: DrizzleDb | null = null;

const dbProxy = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    if (!dbInstance) {
      dbInstance = createDb();
    }
    return (dbInstance as any)[prop];
  },
});

export const db = dbProxy;

export type DbClient = typeof db;

