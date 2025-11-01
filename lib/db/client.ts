import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@/drizzle/schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

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
  // Neon WebSocket 接続の最適化（Node.js で WS を使用）
  neonConfig.webSocketConstructor = (globalThis as any).WebSocket ?? (ws as unknown as typeof WebSocket);
  neonConfig.useSecureWebSocket = true;
  neonConfig.pipelineConnect = "password";
  const pool = new Pool({ connectionString: databaseUrl });
  const dbInstance = drizzle(pool, { schema, logger: process.env.NODE_ENV === "development" });
  
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

