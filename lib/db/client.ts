// ws のネイティブ拡張読み込みを避け、JS実装に固定（Next.js のビルド互換性対策）
if (typeof process !== "undefined") {
  process.env.WS_NO_BUFFER_UTIL = process.env.WS_NO_BUFFER_UTIL || "1";
}
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
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
  const pool = new Pool({ connectionString: databaseUrl, ssl: getPgSsl() });
  const dbInstance = drizzle(pool, {
    schema,
    logger: process.env.NODE_ENV === "development",
  });
  
  if (process.env.NODE_ENV !== "production") {
    globalThis.__drizzleDb__ = dbInstance;
  }
  
  return dbInstance;
}

function getPgSsl(): false | { rejectUnauthorized: boolean } {
  const url = getDatabaseUrl();
  // Neon/Cloud PG 環境では SSL が必要。ローカルでは不要な場合がある。
  if (/neon\.tech|vercel-storage|aws|gcp|azure/i.test(url)) {
    return { rejectUnauthorized: false };
  }
  return false;
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

