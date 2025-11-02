import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

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

export function extractPlayerAuth(
  request: Request | NextRequest,
): { playerId?: string; playerToken?: string } {
  const headers = (request.headers ?? new Headers());
  const headerId = headers.get("x-player-id") ?? headers.get("X-Player-Id") ?? undefined;
  const headerToken = headers.get("x-player-token") ?? headers.get("X-Player-Token") ?? undefined;

  let qpId: string | undefined;
  let qpToken: string | undefined;

  try {
    const url = new URL((request as any).url ?? "");
    qpId = url.searchParams.get("playerId") ?? undefined;
    qpToken = url.searchParams.get("playerToken") ?? undefined;
  } catch {
    // ignore
  }

  const playerId = headerId ?? qpId;
  const playerToken = headerToken ?? qpToken;
  return { playerId, playerToken };
}

export function getClientIp(req: Request | NextRequest): string {
  const headers = req.headers ?? new Headers();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  // @ts-expect-error - NextRequest may have ip
  const direct = (req as any).ip as string | undefined;
  return direct ?? "unknown";
}


