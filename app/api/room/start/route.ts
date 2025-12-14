import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { players } from "@/drizzle/schema";
import { db } from "@/lib/db/client";
import { startHumanGame } from "@/lib/server/game-service";
import { extractPlayerAuth, getClientIp, verifyToken } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { getUserFromRequest } from "@/lib/server/user-auth";
import { and, eq } from "drizzle-orm";

const schema = z.object({
  roomId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const r = rateLimit(`start:${ip}`, 30, 30_000);
    if (!r.ok) {
      return NextResponse.json(
        { error: "しばらくしてからお試しください。" },
        { status: 429, headers: { "Retry-After": Math.ceil((r.resetAt - Date.now()) / 1000).toString() } },
      );
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

    // アカウント紐づけプレイヤーは「ユーザーが所有しているか」で認可（Cookieセッション）
    if (row.userId) {
      const user = await getUserFromRequest(request);
      if (!user || user.id !== row.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (row.authTokenHash) {
      // レガシー: player token で認可
      if (!playerToken || !verifyToken(playerToken, row.authTokenHash)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      // Bot room: allow
    }

    const { gameId } = await startHumanGame(parsed.roomId, playerId);
    return NextResponse.json({ roomId: parsed.roomId, gameId }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "入力が不正です。" }, { status: 400 });
    }
    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: errorMessage || "開始に失敗しました。",
        ...(isDev && {
          detail: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 400 },
    );
  }
}


