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

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const r = rateLimit(`bot-turn:${ip}`, 80, 10_000);
    if (!r.ok) {
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.parse(body);

    const { playerId, playerToken } = extractPlayerAuth(request);
    if (!playerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = (
      await db
        .select()
        .from(players)
        .where(and(eq(players.id, playerId), eq(players.roomId, parsed.roomId)))
    )[0];

    if (!row) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (row.userId) {
      const user = await getUserFromRequest(request);
      if (!user || user.id !== row.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (row.authTokenHash) {
      if (!playerToken || !verifyToken(playerToken, row.authTokenHash)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await executeBotTurn(parsed.roomId, { skipThinkDelay: parsed.skipThinkDelay ?? false });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[API /game/bot-action] client validation error", error);
      return NextResponse.json(
        { error: "Invalid request", details: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`) },
        { status: 400 },
      );
    }

    console.error("[API /game/bot-action] server error", error);
    return NextResponse.json({ error: "Failed to execute bot turn" }, { status: 500 });
  }
}
