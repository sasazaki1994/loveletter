import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { executeBotTurn } from "@/lib/server/game-service";
import { extractPlayerAuth, getClientIp, verifyToken } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { db } from "@/lib/db/client";
import { players } from "@/drizzle/schema";
import { getUserFromRequest } from "@/lib/server/user-auth";

const schema = z.object({
  roomId: z.string().uuid(),
  skipThinkDelay: z.boolean().optional(),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const r = rateLimit(`bot-turn:${ip}`, 80, 10_000);
    if (!r.ok) {
      return errorResponse("Too Many Requests", 429);
    }

    const body = await request.json();
    const parsed = schema.parse(body);

    const { playerId, playerToken } = extractPlayerAuth(request);
    if (!playerId) {
      return errorResponse("Unauthorized", 401);
    }

    const row = (
      await db
        .select()
        .from(players)
        .where(and(eq(players.id, playerId), eq(players.roomId, parsed.roomId)))
    )[0];

    if (!row) {
      return errorResponse("Unauthorized", 401);
    }

    if (row.userId) {
      const user = await getUserFromRequest(request);
      if (!user || user.id !== row.userId) {
        return errorResponse("Unauthorized", 401);
      }
    } else if (row.authTokenHash) {
      if (!playerToken || !verifyToken(playerToken, row.authTokenHash)) {
        return errorResponse("Unauthorized", 401);
      }
    }

    await executeBotTurn(parsed.roomId, { skipThinkDelay: parsed.skipThinkDelay ?? false });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /game/bot-action]", error);

    if (error instanceof z.ZodError) {
      return errorResponse("Invalid request body", 400);
    }

    return errorResponse("Failed to execute bot turn", 400);
  }
}
