import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { db } from "@/lib/db/client";
import { users, userSessions } from "@/drizzle/schema";
import { and, eq, gt } from "drizzle-orm";

const USER_SESSION_COOKIE = "llr_sid";
const USER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

/**
 * サーバ側に保存するセッショントークンの検索用ハッシュ（決定的）
 * - salt 付きだとトークン値からDB検索できないため、sha256 を使う
 * - 可能なら環境変数で pepper を設定
 */
function hashSessionLookupToken(token: string): string {
  const pepper = process.env.AUTH_PEPPER ?? "";
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

function parseCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const cookies = header.split(";").map((c) => c.trim());
  for (const c of cookies) {
    if (!c) continue;
    const [k, ...rest] = c.split("=");
    if (k === name) {
      const v = rest.join("=").trim();
      return v ? decodeURIComponent(v) : "";
    }
  }
  return undefined;
}

function buildCookie(
  name: string,
  value: string,
  maxAgeSec: number,
  { secure }: { secure: boolean },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
    "HttpOnly",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function clearCookie(name: string, { secure }: { secure: boolean }): string {
  const parts = [`${name}=`, "Path=/", "SameSite=Lax", "Max-Age=0", "HttpOnly"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildUserSessionCookies(sessionToken: string | null): string[] {
  const secure = process.env.NODE_ENV === "production";
  if (!sessionToken) return [clearCookie(USER_SESSION_COOKIE, { secure })];
  return [buildCookie(USER_SESSION_COOKIE, sessionToken, USER_SESSION_MAX_AGE_SEC, { secure })];
}

function generateSessionToken(bytes = 32): string {
  // base64url
  return randomBytes(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64);
  return `${salt}:${Buffer.from(key).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!password || !stored || !stored.includes(":")) return false;
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const actual = scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function createUserSession(userId: string): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = generateSessionToken(32);
  const tokenHash = hashSessionLookupToken(sessionToken);
  const expiresAt = new Date(Date.now() + USER_SESSION_MAX_AGE_SEC * 1000);
  await db.insert(userSessions).values({
    userId,
    tokenHash,
    expiresAt,
  });
  return { sessionToken, expiresAt };
}

export async function getUserFromRequest(
  request: Request | NextRequest,
): Promise<{ id: string; username: string } | null> {
  const cookieHeader = request.headers?.get?.("cookie") ?? (request.headers as any)?.get?.("cookie");
  const token = parseCookie(cookieHeader, USER_SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = hashSessionLookupToken(token);
  const now = new Date();

  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(and(eq(userSessions.tokenHash, tokenHash), gt(userSessions.expiresAt, now)))
    .limit(1);

  return rows[0] ?? null;
}

export async function deleteUserSessionFromRequest(request: Request | NextRequest): Promise<void> {
  const cookieHeader = request.headers?.get?.("cookie") ?? (request.headers as any)?.get?.("cookie");
  const token = parseCookie(cookieHeader, USER_SESSION_COOKIE);
  if (!token) return;
  const tokenHash = hashSessionLookupToken(token);
  await db.delete(userSessions).where(eq(userSessions.tokenHash, tokenHash));
}


