import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_ID = "llr_pid";
const AUTH_COOKIE_TOKEN = "llr_ptk";
const AUTH_COOKIE_MAX_AGE_SEC = 60 * 60 * 12; // 12h

export function generateOpaqueToken(bytes: number = 32): string {
  const buf = randomBytes(bytes);
  // base64url (Node 20+)
  // Fallback: manual replace if env lacks base64url
  const b64 = (buf as unknown as Buffer).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function hashToken(token: string): string {
  const salt = generateOpaqueToken(16);
  const key = scryptSync(token, salt, 64);
  const hex = Buffer.from(key).toString("hex");
  return `${salt}:${hex}`;
}

export function verifyToken(plain: string, stored: string): boolean {
  if (!plain || !stored || !stored.includes(":")) return false;
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const actual = scryptSync(plain, salt, 64);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function parseCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const cookies = header.split(";").map((c) => c.trim());
  for (const c of cookies) {
    if (!c) continue;
    const [k, ...rest] = c.split("=");
    if (k === name) {
      return rest.join("=").trim() ? decodeURIComponent(rest.join("=").trim()) : "";
    }
  }
  return undefined;
}

export function extractPlayerAuth(
  request: Request | NextRequest,
): { playerId?: string; playerToken?: string } {
  const headers = request.headers ?? new Headers();

  // ヘッダー優先（APIリクエストで明示的に渡す場合）だが、欠けている値は Cookie で補完
  const headerId = headers.get("x-player-id") ?? headers.get("X-Player-Id") ?? undefined;
  const headerToken = headers.get("x-player-token") ?? headers.get("X-Player-Token") ?? undefined;

  // Cookie 経由（SSEなどヘッダーを付与できない場合の代替）
  const cookieHeader = headers.get("cookie");
  const cookieId = parseCookie(cookieHeader, AUTH_COOKIE_ID);
  const cookieToken = parseCookie(cookieHeader, AUTH_COOKIE_TOKEN);
  return {
    playerId: headerId ?? cookieId,
    playerToken: headerToken ?? cookieToken,
  };
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

export function buildAuthCookies(playerId: string | null, playerToken?: string | null): string[] {
  const secure = process.env.NODE_ENV === "production";
  const cookies: string[] = [];
  if (playerId) {
    cookies.push(buildCookie(AUTH_COOKIE_ID, playerId, AUTH_COOKIE_MAX_AGE_SEC, { secure }));
  } else {
    cookies.push(clearCookie(AUTH_COOKIE_ID, { secure }));
  }
  if (playerToken) {
    cookies.push(buildCookie(AUTH_COOKIE_TOKEN, playerToken, AUTH_COOKIE_MAX_AGE_SEC, { secure }));
  } else {
    cookies.push(clearCookie(AUTH_COOKIE_TOKEN, { secure }));
  }
  return cookies;
}

export function getClientIp(req: Request | NextRequest): string {
  const headers = req.headers ?? new Headers();
  // 信頼できるリバースプロキシで `req.ip` が設定されている場合のみ利用
  const direct = (req as any).ip as string | undefined;
  if (direct) return direct;

  // フォールバックとして最初の転送元を参照するが、ヘッダ偽装の可能性がある点に留意
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();

  return "unknown";
}


