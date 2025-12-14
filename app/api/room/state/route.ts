import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { games, players, rooms } from "@/drizzle/schema";
import { isValidShortRoomId, normalizeRoomId } from "@/lib/utils/room-id";

const querySchema = z.object({
  roomId: z.string().min(1).max(50), // UUID または短いID
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = querySchema.parse(params);

    const raw = parsed.roomId.trim();
    const normalized = normalizeRoomId(raw);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const roomRow = uuidPattern.test(normalized)
      ? (await db.select().from(rooms).where(eq(rooms.id, normalized)))[0]
      : isValidShortRoomId(normalized)
        ? (await db.select().from(rooms).where(eq(rooms.shortId, normalized)))[0]
        : null;

    if (!roomRow) {
      return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });
    }

    const playerRows = await db
      .select()
      .from(players)
      .where(eq(players.roomId, roomRow.id))
      .orderBy(players.seat);

    const gameRow = (
      await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.roomId, roomRow.id))
    )[0];

    return NextResponse.json(
      {
        id: roomRow.id,
        shortId: roomRow.shortId,
        status: roomRow.status,
        hostPlayerId: (roomRow as typeof rooms.$inferSelect).hostPlayerId ?? null,
        playerCount: playerRows.length,
        players: playerRows.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          seat: p.seat,
          isBot: p.isBot,
          lastActiveAt: p.lastActiveAt?.toISOString?.() ?? new Date().toISOString(),
        })),
        hasGame: Boolean(gameRow?.id),
        gameId: gameRow?.id ?? null,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "入力が不正です。" }, { status: 400 });
    }
    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "取得に失敗しました。",
        ...(isDev && { detail: errorMessage, stack: error instanceof Error ? error.stack : undefined }),
      },
      { status: 500 },
    );
  }
}


