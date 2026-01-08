import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as PgPool, Client as PgClient } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "@/drizzle/schema";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

type DrizzleDb = ReturnType<typeof drizzleNeon<typeof schema>> | ReturnType<typeof drizzlePg<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __drizzleDb__: DrizzleDb | undefined;
}

function getDatabaseUrl(): string {
  // MOCK_DBの場合はURLチェックをスキップ
  if (process.env.MOCK_DB === 'true') return "mock://memory";

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

  // MOCK_DB 対応 (pg-mem)
  if (process.env.MOCK_DB === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { newDb, DataType } = require("pg-mem");
    const mem = newDb();

    // UUID生成関数のモック
    mem.public.registerFunction({
      name: "gen_random_uuid",
      args: [],
      returns: DataType.uuid,
      impure: true,
      implementation: () => randomUUID(),
    });

    // マイグレーションの適用
    const migrationsDir = path.join(process.cwd(), "drizzle/migrations");
    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of files) {
        let sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        sql = sql.replace(/DO \$\$[\s\S]*?BEGIN([\s\S]*?)EXCEPTION[\s\S]*?END \$\$;?/g, '$1');
        
        const statements = sql.split('--> statement-breakpoint');
        
        for (let stmt of statements) {
            stmt = stmt.trim();
            if (!stmt) continue;
            try {
                mem.public.many(stmt);
            } catch (e) {
                console.warn(`Migration statement in ${file} failed:`, e);
                console.warn(`Statement: ${stmt}`);
            }
        }
      }
    }

    // MockClientの実装 (PgClientを継承)
    class MockClient extends PgClient {
        constructor() {
            super();
        }

        async connect() { return; }
        async end() { return; }
        async release() { return; }
        
        getTypeParser(oid: number) {
            return (val: any) => val;
        }

        // @ts-ignore
        async query(sql: any, params: any) {
            let text = "";
            let values: any[] = [];

            if (typeof sql === 'string') {
                text = sql;
                values = params || [];
            } else             if (typeof sql === 'object' && sql !== null) {
                console.log('QUERY CONFIG:', JSON.stringify(sql));
                console.log('DEBUG: sql.rowMode:', sql.rowMode, typeof sql.rowMode);
                text = sql.text || sql.sql || "";
                values = sql.values || params || [];
            }
            if (!values) values = [];

            let finalSql = text;
            try {
                if (values.length > 0) {
                    finalSql = text.replace(/\$(\d+)/g, (match: string, index: string) => {
                        const idx = parseInt(index) - 1;
                        if (idx < 0 || idx >= values.length) return match;
                        
                        const val = values[idx];
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'number') return val.toString();
                        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                        if (val instanceof Date) return `'${val.toISOString()}'`;
                        if (Array.isArray(val) || typeof val === 'object') {
                             return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                        }
                        
                        return `'${String(val).replace(/'/g, "''")}'`;
                    });
                }

                const res = mem.public.query(finalSql, []);
                
                // カラム名を小文字に統一し、Date型変換を行う
                let processedRows = res.rows.map((row: any) => {
                    const newRow: any = {};
                    for (const key in row) {
                        const val = row[key];
                        // 日付文字列判定 (ISO 8601)
                        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
                            newRow[key.toLowerCase()] = new Date(val);
                        } else {
                            newRow[key.toLowerCase()] = val;
                        }
                    }
                    return newRow;
                });

                if (finalSql.toLowerCase().startsWith('insert') || finalSql.toLowerCase().startsWith('select')) {
                    console.log('PG-MEM SQL:', finalSql);
                    console.log('MOCK PROCESSED ROWS (Object):', JSON.stringify(processedRows));
                    if (res.fields) {
                        console.log('PG-MEM RAW FIELDS:', JSON.stringify(res.fields.map((f: any) => ({ name: f.name, typeId: f.typeId }))));
                    }
                }

                // rowMode: 'array' のサポート
                if (typeof sql === 'object' && sql !== null && sql.rowMode === 'array') {
                    if (!res.fields) {
                        console.warn('PG-MEM returned no fields for array mode query');
                        processedRows = [];
                    } else {
                        processedRows = processedRows.map((row: any) => {
                            return res.fields.map((field: any) => {
                                // processedRows はキーが小文字化されているので、field.name も小文字化してアクセス
                                return row[field.name.toLowerCase()];
                            });
                        });
                        console.log('MOCK PROCESSED ROWS (Array):', JSON.stringify(processedRows));
                    }
                }

                // Mock fields
                const fields = res.fields?.map((f: any) => ({
                    name: f.name.toLowerCase(), 
                    tableID: 0,
                    columnID: 0,
                    dataTypeID: f.typeId ?? 0,
                    dataTypeSize: 0,
                    dataTypeModifier: -1,
                    format: 'text'
                })) ?? [];

                return {
                    rows: processedRows,
                    rowCount: res.rowCount,
                    command: res.command || 'SELECT',
                    oid: 0,
                    fields: fields,
                };
            } catch (e: any) {
                console.error('MOCK DB ERROR:', e);
                console.error('Final SQL:', finalSql);
                throw e;
            }
        }
    }

    class MockPool extends PgPool {
        constructor() {
            super();
        }
        
        async connect(): Promise<any> { 
            return new MockClient(); 
        }
        
        // @ts-ignore
        async query(sql: any, params: any) {
            const client = new MockClient();
            return client.query(sql, params);
        }
    }

    const pool = new MockPool();
    // @ts-ignore
    const dbInstance = drizzlePg(pool, { schema, logger: false });
    
    if (process.env.NODE_ENV !== "production") {
      globalThis.__drizzleDb__ = dbInstance;
    }
    return dbInstance;
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
